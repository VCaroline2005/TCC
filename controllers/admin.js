import Usuario from '../models/usuario.js';
import Categoria from '../models/categoria.js';
import Procedimento from '../models/procedimento.js';
import Medicamento from '../models/medicamento.js';
import Terminologia from '../models/terminologia.js';
import Quiz from '../models/quiz.js';
import fs from 'node:fs/promises'
import pdfParse from 'pdf-parse'
import { GoogleGenAI } from '@google/genai'
import { uploadPath } from '../utils/uploadPaths.js'

const geminiClient = new GoogleGenAI({})

function isMockMode() {
    const raw = String(process.env.AI_MOCK || process.env.OPENAI_MOCK || '').toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

function extrairJsonDoTexto(texto) {
    if (!texto) return null
    const inicio = texto.indexOf('{')
    const fim = texto.lastIndexOf('}')
    if (inicio === -1 || fim === -1 || fim <= inicio) return null
    const candidato = texto.slice(inicio, fim + 1)
    try {
        return JSON.parse(candidato)
    } catch (err) {
        return null
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function extrairDetalhesErroGemini(err) {
    const mensagem = String(err?.message || err || '')
    const payload = extrairJsonDoTexto(mensagem)
    const code = payload?.error?.code
    const status = payload?.error?.status
    const apiMessage = payload?.error?.message
    const statusCode = err?.status || err?.cause?.status
    return {
        httpCode: typeof code === 'number' ? code : undefined,
        status: typeof status === 'string' ? status : undefined,
        message: typeof apiMessage === 'string' ? apiMessage : undefined,
        statusCode: typeof statusCode === 'number' ? statusCode : undefined,
        retryDelaySeconds: (() => {
            const txt = String(mensagem || '')
            const m = txt.match(/"retryDelay"\s*:\s*"(\d+)s"/)
            if (m) return parseInt(m[1], 10)
            const m2 = txt.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i)
            if (m2) return Math.ceil(parseFloat(m2[1]))
            return undefined
        })()
    }
}

function isErroAltaDemandaGemini(err) {
    const detalhes = extrairDetalhesErroGemini(err)
    if (detalhes.httpCode === 503) return true
    if (detalhes.statusCode === 503) return true
    if (detalhes.status === 'UNAVAILABLE') return true
    const msg = String(err?.message || '')
    return msg.includes('"code":503') || msg.includes('"status":"UNAVAILABLE"')
}

function parseListaModelosGemini() {
    const raw = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    return parts.length ? parts : ['gemini-2.5-flash']
}

export async function abreadmin(req, res) {
    const [
        usuarios,
        categorias,
        procedimentos,
        medicamentos,
        terminologias,
        quizzes
    ] = await Promise.all([
        Usuario.countDocuments({}),
        Categoria.countDocuments({}),
        Procedimento.countDocuments({}),
        Medicamento.countDocuments({}),
        Terminologia.countDocuments({}),
        Quiz.countDocuments({})
    ])

    res.render('admin/index', {
        totais: {
            usuarios,
            categorias,
            procedimentos,
            medicamentos,
            terminologias,
            quizzes
        }
    })
}

async function gerarConteudoGeminiComRetry({ model, contents }) {
    // Alta demanda (503) e quota (429) são temporários; tenta novamente com backoff.
    const maxTentativas = Math.max(1, Math.min(8, parseInt(process.env.GEMINI_MAX_RETRIES || '5', 10) || 5))
    let ultimaFalha

    for (let tentativa = 0; tentativa < maxTentativas; tentativa += 1) {
        try {
            return await geminiClient.models.generateContent({ model, contents })
        } catch (err) {
            ultimaFalha = err
            const detalhes = extrairDetalhesErroGemini(err)
            const retryDelay = typeof detalhes.retryDelaySeconds === 'number' ? detalhes.retryDelaySeconds * 1000 : null
            const isQuota = detalhes.httpCode === 429 || detalhes.statusCode === 429 || detalhes.status === 'RESOURCE_EXHAUSTED' || err?.status === 429 || err?.cause?.status === 429
            const isAltaDemanda = isErroAltaDemandaGemini(err)
            const retryable = isQuota || isAltaDemanda

            if (!retryable || tentativa >= maxTentativas - 1) throw err

            const base = retryDelay ?? Math.min(15000, 800 * (2 ** tentativa))
            const jitter = Math.round(Math.random() * 350)
            await sleep(base + jitter)
        }
    }

    throw ultimaFalha
}

function normalizaMedicamentoItem(item) {
    const nomeComercial = normalizaCampo(item?.nomeComercial || item?.nome || item?.comercial)
    if (!nomeComercial) return null
    const principioAtivo = normalizaCampo(item?.principioAtivo || item?.principio || item?.ativo)
    const classe = normalizaCampo(item?.classe)
    const via = normalizaCampo(item?.via)
    const diluicao = normalizaCampo(item?.diluicao || item?.diluição)
    return { principioAtivo, nomeComercial, classe, via, diluicao }
}

function gerarMedicamentosMock(textoBase) {
    // heurística simples para testes locais: tenta achar linhas que parecem "NOME - VIA"
    const linhas = String(textoBase || '').split(/\r?\n/).map(normalizaLinhaPdf).filter(Boolean)
    const out = []
    for (const l of linhas) {
        const parts = l.split(/\s{2,}|\t+/).map(normalizaCampo).filter(Boolean)
        if (parts.length < 2) continue
        const nomeComercial = parts[0]
        if (!nomeComercial || nomeComercial.length < 3) continue
        out.push({
            principioAtivo: null,
            nomeComercial,
            classe: parts[1] || null,
            via: parts[2] || null,
            diluicao: parts[3] || null
        })
        if (out.length >= 30) break
    }
    return out
}

async function extrairMedicamentosComGemini(textoBase) {
    if (!process.env.GEMINI_API_KEY) {
        const erro = new Error('GEMINI_API_KEY não configurada')
        erro.code = 'sem_chave'
        throw erro
    }

    const prompt = [
        'Você é um assistente que extrai medicamentos de um texto que veio de um PDF.',
        'Objetivo: retornar uma lista estruturada de medicamentos para cadastro.',
        '',
        'Regras importantes:',
        '- Responda APENAS com JSON válido (sem texto extra).',
        '- Não invente dados. Se um campo não estiver no texto, use null.',
        '- Remova duplicados por nomeComercial (ignorando maiúsculas/minúsculas).',
        '- Preserve as strings como aparecem (apenas limpe espaços).',
        '',
        'Formato de resposta:',
        '{"medicamentos":[{"principioAtivo":null,"nomeComercial":"...","classe":null,"via":null,"diluicao":null}]}',
        '',
        'Texto base:',
        textoBase
    ].join('\n')

    const modelos = parseListaModelosGemini()
    let resposta
    let ultimoErro

    for (let i = 0; i < modelos.length; i += 1) {
        const modelo = modelos[i]
        try {
            resposta = await gerarConteudoGeminiComRetry({ model: modelo, contents: prompt })
            break
        } catch (err) {
            ultimoErro = err
            // se é alta demanda/quota, tentar próximo modelo pode ajudar; caso contrário, pare.
            const detalhes = extrairDetalhesErroGemini(err)
            const isQuota = detalhes.httpCode === 429 || detalhes.statusCode === 429 || detalhes.status === 'RESOURCE_EXHAUSTED' || err?.status === 429 || err?.cause?.status === 429
            const isAltaDemanda = isErroAltaDemandaGemini(err)
            if ((isQuota || isAltaDemanda) && i < modelos.length - 1) continue

            const erro = new Error(`Gemini API erro: ${err?.message || err}`, { cause: err })
            erro.code = isQuota ? 'quota' : 'api'
            if (detalhes.httpCode) erro.apiHttpCode = detalhes.httpCode
            if (detalhes.statusCode) erro.apiHttpCode = detalhes.statusCode
            if (detalhes.status) erro.apiStatus = detalhes.status
            if (detalhes.message) erro.apiMessage = detalhes.message
            if (detalhes.retryDelaySeconds) erro.apiRetryDelaySeconds = detalhes.retryDelaySeconds
            throw erro
        }
    }

    if (!resposta && ultimoErro) {
        const detalhes = extrairDetalhesErroGemini(ultimoErro)
        const isQuota = detalhes.httpCode === 429 || detalhes.statusCode === 429 || detalhes.status === 'RESOURCE_EXHAUSTED' || ultimoErro?.status === 429 || ultimoErro?.cause?.status === 429
        const erro = new Error(`Gemini API erro: ${ultimoErro?.message || ultimoErro}`, { cause: ultimoErro })
        erro.code = isQuota ? 'quota' : 'api'
        if (detalhes.httpCode) erro.apiHttpCode = detalhes.httpCode
        if (detalhes.statusCode) erro.apiHttpCode = detalhes.statusCode
        if (detalhes.status) erro.apiStatus = detalhes.status
        if (detalhes.message) erro.apiMessage = detalhes.message
        if (detalhes.retryDelaySeconds) erro.apiRetryDelaySeconds = detalhes.retryDelaySeconds
        throw erro
    }

    const textoResposta = typeof resposta?.text === 'string' ? resposta.text : ''
    const payload = extrairJsonDoTexto(textoResposta)
    const lista = Array.isArray(payload?.medicamentos) ? payload.medicamentos : []
    const unicos = []
    const vistos = new Set()
    for (const raw of lista) {
        const med = normalizaMedicamentoItem(raw)
        if (!med) continue
        const chave = String(med.nomeComercial).toLowerCase().trim()
        if (!chave || vistos.has(chave)) continue
        vistos.add(chave)
        unicos.push(med)
        if (unicos.length >= 500) break
    }
    if (!unicos.length) {
        const erro = new Error('Resposta sem medicamentos válidos')
        erro.code = 'parse'
        throw erro
    }
    return unicos
}

function normalizaLinhaPdf(linha) {
    return String(linha || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
}

function normalizaCampo(valor) {
    const texto = String(valor || '').replace(/\s+/g, ' ').trim()
    return texto ? texto : null
}

function parseMedicamentosTexto(texto) {
    const bruto = String(texto || '')
    const linhas = bruto
        .split(/\r?\n/)
        .map(normalizaLinhaPdf)
        .filter((l) => l.length > 0)

    const rotulos = {
        principioAtivo: /(princ[ií]pio\s*ativo|principio\s*ativo|pa)\s*[:\-]\s*(.+)$/i,
        nomeComercial: /(nome\s*comercial|nome)\s*[:\-]\s*(.+)$/i,
        classe: /(classe)\s*[:\-]\s*(.+)$/i,
        via: /(via(?:\s*de\s*administra[cç][aã]o)?)\s*[:\-]\s*(.+)$/i,
        diluicao: /(dilui[cç][aã]o)\s*[:\-]\s*(.+)$/i
    }

    function ehInicioBloco(linha) {
        return /(nome\s*comercial)\s*[:\-]/i.test(linha) || /(princ[ií]pio\s*ativo)\s*[:\-]/i.test(linha)
    }

    const blocos = []
    let atual = []
    for (const linha of linhas) {
        if (ehInicioBloco(linha) && atual.length) {
            blocos.push(atual)
            atual = []
        }
        atual.push(linha)
    }
    if (atual.length) blocos.push(atual)

    const encontrados = []

    for (const bloco of blocos) {
        let teveRotulo = false
        const med = {
            principioAtivo: null,
            nomeComercial: null,
            classe: null,
            via: null,
            diluicao: null
        }

        for (let i = 0; i < bloco.length; i++) {
            const linha = bloco[i]
            let m
            if (!med.principioAtivo && (m = linha.match(rotulos.principioAtivo))) { med.principioAtivo = normalizaCampo(m[2]); teveRotulo = true }
            if (!med.nomeComercial && (m = linha.match(rotulos.nomeComercial))) { med.nomeComercial = normalizaCampo(m[2]); teveRotulo = true }
            if (!med.classe && (m = linha.match(rotulos.classe))) { med.classe = normalizaCampo(m[2]); teveRotulo = true }
            if (!med.via && (m = linha.match(rotulos.via))) { med.via = normalizaCampo(m[2]); teveRotulo = true }
            if (!med.diluicao && (m = linha.match(rotulos.diluicao))) { med.diluicao = normalizaCampo(m[2]); teveRotulo = true }
        }

        // Evita falsos positivos: só aceita nome "solto" se o bloco tiver rótulos (nome/via/classe etc.)
        if (!med.nomeComercial && teveRotulo) {
            const candidato = normalizaCampo(bloco[0])
            if (candidato && candidato.length >= 3 && candidato.length <= 120) med.nomeComercial = candidato
        }

        if (med.nomeComercial) {
            encontrados.push(med)
        }
    }

    // fallback: tentativa simples de tabela (linhas com várias colunas separadas por espaços)
    if (encontrados.length === 0) {
        for (const linha of linhas) {
            const partes = linha.split(/\s{2,}|\t+/).map(normalizaCampo).filter(Boolean)
            if (partes.length < 3) continue

            // Heurística: nome comercial costuma ser a 2ª coluna quando existe princípio ativo
            const [c0, c1, c2, c3, c4] = partes
            const nomeComercial = c1 || c0
            if (!nomeComercial) continue

            encontrados.push({
                principioAtivo: c0 || null,
                nomeComercial: nomeComercial || null,
                classe: c2 || null,
                via: c3 || null,
                diluicao: c4 || null
            })
        }
    }

    // remove duplicados simples por nomeComercial
    const vistos = new Set()
    const unicos = []
    for (const item of encontrados) {
        const chave = String(item.nomeComercial || '').toLowerCase().trim()
        if (!chave || vistos.has(chave)) continue
        vistos.add(chave)
        unicos.push(item)
    }
    return unicos
}

function parseCorretaInput(valor) {
    if (valor === undefined || valor === null) return NaN
    const texto = String(valor).trim()
    if (!texto) return NaN
    if (/^[A-Za-z]$/.test(texto)) {
        return texto.toUpperCase().charCodeAt(0) - 65
    }
    if (/^[0-9]+$/.test(texto)) {
        return parseInt(texto, 10)
    }
    return NaN
}

export async function listarusuarios(req, res){
    const usuarios = await Usuario.find({}).catch(function(err){console.log(err)});
    res.render('admin/usuarios/lst', {usuarios: usuarios});
}

export async function detalhe(req, res) {
    const usuario = await Usuario.findById(req.params.id);
    res.render('admin/usuarios/detalhe', {usuario: usuario});
}

export async function deletarusuario(req, res) {
    await Usuario.findByIdAndDelete(req.params.id)
    res.redirect('/admin/usuarios/lst')
}

export async function abreaddcategoria(req, res) {
    res.render('admin/categoria/add')
}

export async function addcategoria(req, res) {
    await Categoria.create({
        nome:req.body.nome
    })
    res.redirect('/admin/categoria/add')
}

export async function listarcategoria(req, res) {
    const categorias = await Categoria.find({})
    res.render('admin/categoria/lst',{Categorias: categorias});
}

export async function filtrarcategoria(req, res) {
    const categorias = await Categoria.find({nome: new RegExp(req.body.pesquisar,"i")})
    res.render('admin/categoria/lst',{Categorias: categorias});
}

export async function deletacategoria(req, res) {
    await Categoria.findByIdAndDelete(req.params.id)
    res.redirect('/admin/categoria/lst')
}

export async function abreedtcategoria(req, res){
    const categoria = await Categoria.findById(req.params.id)
    res.render('admin/categoria/edt.ejs',{Categoria: categoria})
}

export async function edtcategoria(req, res){
    await Categoria.findByIdAndUpdate(req.params.id, req.body)
    res.redirect('/admin/categoria/lst')
}

export async function abreaddprocedimento(req, res) {
    res.render('admin/procedimento/add')
}

export async function addprocedimento(req, res) {
    console.log(req.files)
    let fotos = [];
    for (var i = 0; i < req.files.length; i++) {
        fotos[i] = req.files[i].filename;
    }
    await Procedimento.create({
        nome:req.body.nome,
        descricao: req.body.descricao,
        categoria: req.body.categoria,
        passos: req.body.passos ? req.body.passos.split('\n') : [],
        fotos: fotos,
    })
    res.redirect('/admin/procedimento/add')
}

export async function listarprocedimento(req, res) {
    const procedimentos = await Procedimento.find({})
    res.render('admin/procedimento/lst',{Procedimentos: procedimentos});
}

export async function filtrarprocedimento(req, res) {
    const procedimentos = await Procedimento.find({nome: new RegExp(req.body.pesquisar,"i")})
    res.render('admin/procedimento/lst',{Procedimentos: procedimentos});
}

export async function deletaprocedimento(req, res) {
    const proc = await Procedimento.findByIdAndDelete(req.params.id)
    if (proc?.popPdfNome) {
        const caminho = uploadPath('uploads', 'pops', proc.popPdfNome)
        try {
            await fs.unlink(caminho)
        } catch (err) {
            // ignora (arquivo pode já ter sido removido)
        }
    }
    res.redirect('/admin/procedimento/lst')
}

export async function publicarprocedimento(req, res) {
    await Procedimento.findByIdAndUpdate(req.params.id, { publicado: true, publicadoEm: new Date() })
    res.redirect('/admin/procedimento/lst')
}

export async function despublicarprocedimento(req, res) {
    await Procedimento.findByIdAndUpdate(req.params.id, { publicado: false, publicadoEm: null })
    res.redirect('/admin/procedimento/lst')
}

export async function abreedtprocedimento(req, res){
    const procedimento = await Procedimento.findById(req.params.id)
    res.render('admin/procedimento/edt.ejs',{Procedimento: procedimento})
}

export async function edtprocedimento(req, res){
    await Procedimento.findByIdAndUpdate(req.params.id, req.body)
    res.redirect('/admin/procedimento/lst')
}

export async function abreImportPopPdf(req, res) {
    const erro = req.query?.erro ? String(req.query.erro) : null
    const resultado = (req.query && req.query.inseridos)
        ? { inseridos: Number(req.query.inseridos || 0) }
        : null
    res.render('admin/procedimento/import-pop', { erro, resultado })
}

export async function importPopPdf(req, res) {
    const arquivos = Array.isArray(req.files) ? req.files : []
    if (!arquivos.length) {
        return res.redirect('/admin/procedimento/import-pop?erro=Envie%20um%20ou%20mais%20arquivos%20PDF.')
    }

    const categoria = String(req.body?.categoria || '').trim() || null
    const publicar = !!req.body?.publicar

    let inseridos = 0
    try {
        for (const file of arquivos) {
            const nomeBase = String(file.originalname || 'POP')
                .replace(/\.pdf$/i, '')
                .replace(/\s+/g, ' ')
                .trim()
            const nome = nomeBase || 'POP sem título'

            await Procedimento.create({
                nome,
                descricao: null,
                categoria,
                passos: [],
                fotos: [],
                popPdfNome: file.filename,
                popPdfOriginal: file.originalname,
                popPdfMimeType: file.mimetype,
                popPdfTamanho: file.size,
                publicado: publicar,
                publicadoEm: publicar ? new Date() : null
            })
            inseridos += 1
        }
        return res.redirect(`/admin/procedimento/import-pop?inseridos=${encodeURIComponent(String(inseridos))}`)
    } catch (err) {
        console.error(err)
        // tenta limpar arquivos do upload caso falhe
        for (const file of arquivos) {
            try {
                await fs.unlink(file.path)
            } catch (e) {}
        }
        return res.redirect('/admin/procedimento/import-pop?erro=Erro%20ao%20importar%20PDF(s).')
    }
}

// --------- terminologia CRUD ---------
export async function abreaddterminologia(req, res) {
    res.render('admin/terminologia/add')
}

export async function addterminologia(req, res) {
    await Terminologia.create({
        termo: req.body.termo,
        definicao: req.body.definicao,
        categoria: req.body.categoria
    })
    res.redirect('/admin/terminologia/add')
}

export async function listarterminologia(req, res) {
    const termos = await Terminologia.find({})
    res.render('admin/terminologia/lst',{Termos: termos});
}

export async function filtrarterminologia(req, res) {
    const termos = await Terminologia.find({termo: new RegExp(req.body.pesquisar,"i")})
    res.render('admin/terminologia/lst',{Termos: termos});
}

export async function deletarterminologia(req, res) {
    await Terminologia.findByIdAndDelete(req.params.id)
    res.redirect('/admin/terminologia/lst')
}

export async function publicarterminologia(req, res) {
    await Terminologia.findByIdAndUpdate(req.params.id, { publicado: true, publicadoEm: new Date() })
    res.redirect('/admin/terminologia/lst')
}

export async function despublicarterminologia(req, res) {
    await Terminologia.findByIdAndUpdate(req.params.id, { publicado: false, publicadoEm: null })
    res.redirect('/admin/terminologia/lst')
}

export async function abreedtterminologia(req, res){
    const termo = await Terminologia.findById(req.params.id)
    res.render('admin/terminologia/edt.ejs',{Termo: termo})
}

export async function edtterminologia(req, res){
    await Terminologia.findByIdAndUpdate(req.params.id, req.body)
    res.redirect('/admin/terminologia/lst')
}

// --------- medicamento CRUD ---------
export async function abreaddmedicamento(req,res){
    res.render('admin/medicamento/add')
}
export async function addmedicamento(req,res){
    const nomeComercial = req.body.nomeComercial || req.body.nome

    await Medicamento.create({
        principioAtivo: req.body.principioAtivo,
        nomeComercial: nomeComercial,
        classe: req.body.classe,
        via: req.body.via,
        diluicao: req.body.diluicao,
        detalhes: req.body.detalhes,

        // compatibilidade com telas antigas
        nome: nomeComercial,
        descricao: req.body.detalhes,
        dosagem: req.body.diluicao,
        fabricante: req.body.classe,

        fotos: req.files ? req.files.map(f => f.filename) : []
    })

    res.redirect('/admin/medicamento/add')
}
export async function listarmedicamento(req,res){
    const meds = await Medicamento.find({})
    res.render('admin/medicamento/lst',{Medicamentos:meds});
}
export async function filtrarmedicamento(req,res){
    const busca = new RegExp(req.body.pesquisar,'i')
    const meds = await Medicamento.find({
        $or: [
            {principioAtivo: busca},
            {nomeComercial: busca},
            {classe: busca},
            {via: busca},
            {diluicao: busca},
            {nome: busca}
        ]
    })
    res.render('admin/medicamento/lst',{Medicamentos:meds});
}
export async function deletarmedicamento(req,res){
    await Medicamento.findByIdAndDelete(req.params.id)
    res.redirect('/admin/medicamento/lst')
}
export async function publicarmedicamento(req,res){
    await Medicamento.findByIdAndUpdate(req.params.id, { publicado: true, publicadoEm: new Date() })
    res.redirect('/admin/medicamento/lst')
}
export async function despublicarmedicamento(req,res){
    await Medicamento.findByIdAndUpdate(req.params.id, { publicado: false, publicadoEm: null })
    res.redirect('/admin/medicamento/lst')
}
export async function abreedtmedicamento(req,res){
    const med = await Medicamento.findById(req.params.id)
    res.render('admin/medicamento/edt',{Medicamento:med})

}
export async function edtmedicamento(req,res){
    const nomeComercial = req.body.nomeComercial || req.body.nome

    console.log('DETALHES RECEBIDOS:', req.body.detalhes)

    await Medicamento.findByIdAndUpdate(req.params.id, {
        principioAtivo: req.body.principioAtivo,
        nomeComercial: nomeComercial,
        classe: req.body.classe,
        via: req.body.via,
        diluicao: req.body.diluicao,
        detalhes: req.body.detalhes,

        nome: nomeComercial,
        descricao: req.body.detalhes,
        dosagem: req.body.diluicao,
        fabricante: req.body.classe
    })

    res.redirect('/admin/medicamento/lst')
}

export async function abreimportmedicamento(req, res) {
    // limpeza simples de sessões antigas
    try {
        const imports = req.session?.medicamentoImports
        if (imports && typeof imports === 'object') {
            const agora = Date.now()
            for (const [k, v] of Object.entries(imports)) {
                const criadoEm = typeof v?.criadoEm === 'number' ? v.criadoEm : 0
                if (!criadoEm || (agora - criadoEm) > (1000 * 60 * 60)) {
                    delete imports[k]
                }
            }
        }
    } catch (err) {
        // ignore
    }

    const erro = req.query?.erro ? String(req.query.erro) : null
    const resultado = (req.query && (req.query.inseridos || req.query.atualizados || req.query.ignorados))
        ? {
            inseridos: Number(req.query.inseridos || 0),
            atualizados: Number(req.query.atualizados || 0),
            ignorados: Number(req.query.ignorados || 0)
        }
        : null

    res.render('admin/medicamento/import', { erro, resultado })
}

export async function importmedicamento(req, res) {
    if (!req.file) {
        return res.redirect('/admin/medicamento/import?erro=Envie%20um%20arquivo%20PDF.')
    }

    const caminho = req.file.path
    const atualizar = !!req.body?.atualizar

    try {
        const buffer = await fs.readFile(caminho)
        const pdfData = await pdfParse(buffer)
        const texto = String(pdfData?.text || '')
        const textoBaseAi = texto
            .replace(/\r/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
        const mockMode = isMockMode()
        const aiDisponivel = Boolean(process.env.GEMINI_API_KEY) || mockMode

        let medicamentos
        let avisoAiFalhou = null
        if (aiDisponivel) {
            const textoBase = textoBaseAi.length > 20000 ? textoBaseAi.slice(0, 20000) : textoBaseAi
            try {
                medicamentos = mockMode
                    ? gerarMedicamentosMock(textoBase)
                    : await extrairMedicamentosComGemini(textoBase)
            } catch (err) {
                // fallback para parser local caso a IA falhe
                const retryIn = typeof err?.apiRetryDelaySeconds === 'number' ? err.apiRetryDelaySeconds : null
                const isQuota = err?.code === 'quota' || err?.apiHttpCode === 429 || err?.apiStatus === 'RESOURCE_EXHAUSTED'
                const isAltaDemanda = err?.apiHttpCode === 503 || err?.apiStatus === 'UNAVAILABLE'
                if (isQuota) {
                    console.warn(`Gemini quota excedida. Usando parser local. Retry em ~${retryIn ?? '?'}s.`)
                } else if (isAltaDemanda) {
                    console.warn('Gemini em alta demanda (503). Usando parser local e liberando revisão manual.')
                } else {
                    console.error(err)
                }
                medicamentos = parseMedicamentosTexto(texto)

                // sinaliza na revisão que a IA falhou (para o admin revisar com mais atenção)
                if (!req.session) req.session = {}
                if (!req.session.medicamentoImportAvisos) req.session.medicamentoImportAvisos = {}
                const aviso = isQuota
                    ? `IA indisponível (limite de uso). Extração simples aplicada${retryIn ? `; tente novamente em ~${retryIn}s` : ''}.`
                    : isAltaDemanda
                        ? 'IA temporariamente indisponível (alta demanda). Extração simples aplicada; revise com atenção e tente novamente mais tarde.'
                    : 'IA indisponível. Extração simples aplicada.'
                req.session.medicamentoImportAvisos.__last = aviso
                avisoAiFalhou = aviso
            }
        } else {
            medicamentos = parseMedicamentosTexto(texto)
        }

        if (!medicamentos.length) {
            if (avisoAiFalhou) {
                return res.redirect('/admin/medicamento/import?erro=IA%20indispon%C3%ADvel%20no%20momento.%20Tente%20novamente%20em%20alguns%20minutos%20ou%20use%20um%20PDF%20com%20padr%C3%A3o%20mais%20consistente.')
            }
            return res.redirect('/admin/medicamento/import?erro=N%C3%A3o%20foi%20poss%C3%ADvel%20extrair%20medicamentos%20desse%20PDF.')
        }

        const importId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        if (!req.session) req.session = {}
        if (!req.session.medicamentoImports) req.session.medicamentoImports = {}
        const aviso = req.session?.medicamentoImportAvisos?.__last
        if (req.session?.medicamentoImportAvisos) {
            delete req.session.medicamentoImportAvisos.__last
        }
        req.session.medicamentoImports[importId] = {
            atualizar,
            criadoEm: Date.now(),
            medicamentos,
            aviso: aviso || null
        }
        return res.redirect(`/admin/medicamento/import/revisar/${encodeURIComponent(importId)}`)
    } catch (err) {
        console.error(err)
        return res.redirect('/admin/medicamento/import?erro=Erro%20ao%20processar%20o%20PDF.')
    } finally {
        try {
            await fs.unlink(caminho)
        } catch (err) {
            // ignore
        }
    }
}

export async function abreRevisarImportMedicamento(req, res) {
    const importId = String(req.params.id || '').trim()
    const sess = req.session?.medicamentoImports?.[importId]
    if (!sess) {
        return res.redirect('/admin/medicamento/import?erro=Importa%C3%A7%C3%A3o%20n%C3%A3o%20encontrada%20ou%20expirada.')
    }
    const medicamentos = Array.isArray(sess.medicamentos) ? sess.medicamentos : []
    const atualizar = !!sess.atualizar
    const aviso = sess.aviso ? String(sess.aviso) : null
    res.render('admin/medicamento/revisar-import', {
        importId,
        medicamentos,
        atualizar,
        aviso,
        erro: req.query?.erro || null
    })
}

export async function confirmarImportMedicamento(req, res) {
    const importId = String(req.params.id || '').trim()
    const sess = req.session?.medicamentoImports?.[importId]
    if (!sess) {
        return res.redirect('/admin/medicamento/import?erro=Importa%C3%A7%C3%A3o%20n%C3%A3o%20encontrada%20ou%20expirada.')
    }

    const atualizar = !!sess.atualizar
    const publicar = !!req.body?.publicar
    const itens = Array.isArray(req.body?.medicamentos) ? req.body.medicamentos : []

    const docs = itens
        .map((m) => {
            const nomeComercial = normalizaCampo(m?.nomeComercial)
            if (!nomeComercial) return null
            const principioAtivo = normalizaCampo(m?.principioAtivo)
            const classe = normalizaCampo(m?.classe)
            const via = normalizaCampo(m?.via)
            const diluicao = normalizaCampo(m?.diluicao)
            return {
                principioAtivo,
                nomeComercial,
                classe,
                via,
                diluicao,
                nome: nomeComercial,
                descricao: principioAtivo,
                dosagem: diluicao,
                fabricante: classe,
                fotos: [],
                publicado: publicar ? true : false,
                publicadoEm: publicar ? new Date() : null
            }
        })
        .filter(Boolean)

    if (!docs.length) {
        return res.redirect(`/admin/medicamento/import/revisar/${encodeURIComponent(importId)}?erro=Nenhum%20item%20v%C3%A1lido%20para%20salvar.`)
    }

    let inseridos = 0
    let atualizados = 0
    let ignorados = itens.length - docs.length

    try {
        if (atualizar) {
            const ops = docs.map((doc) => ({
                updateOne: {
                    filter: { nomeComercial: doc.nomeComercial },
                    update: { $set: doc, $setOnInsert: { publicado: doc.publicado, publicadoEm: doc.publicadoEm } },
                    upsert: true
                }
            }))
            const r = await Medicamento.bulkWrite(ops, { ordered: false })
            inseridos = r.upsertedCount || 0
            atualizados = r.matchedCount || 0
        } else {
            await Medicamento.insertMany(docs, { ordered: false })
            inseridos = docs.length
        }
    } catch (err) {
        console.error(err)
        const msg = String(err?.message || '')
        const semMongo =
            msg.includes('MongooseServerSelectionError') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('connect EPERM') ||
            msg.includes('Server selection timed out')
        const erroTexto = semMongo
            ? 'Sem conexão com o MongoDB. Inicie o Mongo local ou configure MONGODB_URI no .env.'
            : 'Erro ao salvar no banco.'
        return res.redirect(`/admin/medicamento/import/revisar/${encodeURIComponent(importId)}?erro=${encodeURIComponent(erroTexto)}`)
    } finally {
        // limpa sessão do import para não acumular
        try {
            delete req.session.medicamentoImports[importId]
        } catch (err) {
            // ignore
        }
    }

    return res.redirect(`/admin/medicamento/import?inseridos=${inseridos}&atualizados=${atualizados}&ignorados=${ignorados}`)
}

// --------- quiz CRUD (simple) ---------
export async function abreaddquiz(req, res) {
    res.render('admin/quiz/add', { erro: req.query.erro })
}

export async function addquiz(req, res) {
    const correta = parseCorretaInput(req.body.correta)
    if (Number.isNaN(correta)) {
        return res.redirect('/admin/quiz/add?erro=correta')
    }
    const usuarioId = req.session?.usuario?.id || 'admin'
    await Quiz.create({
        usuario: usuarioId,
        pergunta:req.body.pergunta,
        opcoes: req.body.opcoes ? req.body.opcoes.split("\n") : [],
        correta,
        categoria: req.body.categoria
    })
    res.redirect('/admin/quiz/add')
}

export async function listarquiz(req, res) {
    const perguntas = await Quiz.find({})
    res.render('admin/quiz/lst',{Quizzes: perguntas});
}

export async function abreedtquiz(req, res) {
    const quiz = await Quiz.findById(req.params.id)
    res.render('admin/quiz/edt.ejs', {Quiz: quiz, erro: req.query.erro})
}

export async function edtquiz(req, res) {
    const correta = parseCorretaInput(req.body.correta)
    if (Number.isNaN(correta)) {
        return res.redirect('/admin/quiz/edt/' + req.params.id + '?erro=correta')
    }
    await Quiz.findByIdAndUpdate(req.params.id, {
        pergunta: req.body.pergunta,
        opcoes: req.body.opcoes ? req.body.opcoes.split("\n") : [],
        correta,
        categoria: req.body.categoria
    })
    res.redirect('/admin/quiz/lst')
}

export async function deletarquiz(req, res) {
    await Quiz.findByIdAndDelete(req.params.id)
    res.redirect('/admin/quiz/lst')
}

export async function publicarquiz(req, res) {
    await Quiz.findByIdAndUpdate(req.params.id, { publicado: true, publicadoEm: new Date() })
    res.redirect('/admin/quiz/lst')
}

export async function despublicarquiz(req, res) {
    await Quiz.findByIdAndUpdate(req.params.id, { publicado: false, publicadoEm: null })
    res.redirect('/admin/quiz/lst')
}

// notes/reminders for administrators
// (none implemented yet)
