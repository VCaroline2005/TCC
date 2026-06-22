import usuario from '../models/usuario.js'
import Procedimento from '../models/procedimento.js'
import Medicamento from '../models/medicamento.js'
import Terminologia from '../models/terminologia.js'
import Quiz from '../models/quiz.js'
import Conteudo from '../models/conteudo.js'
import fs from 'node:fs/promises'
import pdfParse from 'pdf-parse'
import { GoogleGenAI } from '@google/genai'
import { formatTelefoneBR, normalizeTelefoneBR } from '../utils/telefone.js'
import { uploadPath } from '../utils/uploadPaths.js'

export async function abrecadastro(req, res){
    res.render('cadastro')
}

export async function cadastro(req, res){
    try{
        const admin = req.body.espaco === 'admin';
        const foto = req.file ? req.file.filename : null;
        let telefoneNormalizado = ''
        try {
            telefoneNormalizado = normalizeTelefoneBR(req.body.telefone)
        } catch (e) {
            if (e && e.code === 'telefone_invalido') {
                return res.render('cadastro', { error: 'Telefone inválido. Use DDD + número (ex.: (11) 91234-5678).' })
            }
            throw e
        }

        const novousuario = new usuario({
            nome: req.body.nome,
            email: req.body.email,
            senha: req.body.senha,
            endereco: req.body.endereco,
            foto: foto,
            telefone: telefoneNormalizado,
            cpf: req.body.cpf,
            admin: admin
        })

        await novousuario.save();
        return res.redirect('/login?cadastro=ok')
    }catch(err){
        console.error(err)
        if(err.code === 11000){
            return res.render('cadastro', { error: 'E-mail já cadastrado.' })
        }
        return res.render('cadastro', { error: 'Erro ao cadastrar usuário.' })
    }
}

export async function abrelogin(req, res){
    res.render('login', { cadastro: req.query.cadastro, senha: req.query.senha })
}

export async function login(req, res){
    try{
        const email = req.body.email || req.body.username
        const senha = req.body.password || req.body.senha

        if(!email || !senha){
            return res.render('login', { error: 'Preencha e-mail e senha.' })
        }

        const user = await usuario.findOne({ email: email })
        if(!user){
            return res.render('login', { error: 'Usuário não encontrado.' })
        }

        // Senhas estão sendo guardadas em texto puro no cadastro atual
        if(user.senha !== senha){
            return res.render('login', { error: 'Senha incorreta.' })
        }

        const valorAdmin = user.admin
        const isAdmin = valorAdmin === true || valorAdmin === 'true' || valorAdmin === 'on' || valorAdmin === 1 || valorAdmin === '1'

        // normaliza registros antigos que não estavam com boolean correto
        if (typeof valorAdmin !== 'boolean') {
            await usuario.findByIdAndUpdate(user._id, { admin: isAdmin })
        }

        // Autenticação concluída; direciona por perfil
        req.session.usuario = {
            id: user._id.toString(),
            nome: user.nome,
            email: user.email,
            admin: isAdmin
        }
        if (isAdmin) {
            return res.redirect('/admin/usuarios/lst')
        }
        return res.redirect('/home')
    }catch(err){
        console.error(err)
        return res.render('login', { error: 'Erro no servidor.' })
    }
}

export async function sair(req, res){
    if (!req.session) {
        return res.redirect('/login')
    }
    req.session.destroy(() => {
        res.redirect('/login')
    })
}

export async function abreRecuperarSenha(req, res){
    res.render('recuperar-senha', {
        error: req.query.error,
        sucesso: req.query.sucesso
    })
}

export async function recuperarSenha(req, res){
    try{
        const email = (req.body.email || '').trim()
        const senha = (req.body.senha || '').trim()
        const confirmar = (req.body.confirmar || '').trim()

        if (!email || !senha || !confirmar) {
            return res.redirect('/recuperar-senha?error=campos')
        }

        if (senha.length < 6) {
            return res.redirect('/recuperar-senha?error=tamanho')
        }

        if (senha !== confirmar) {
            return res.redirect('/recuperar-senha?error=confirmar')
        }

        const user = await usuario.findOne({ email: email })
        if (!user) {
            return res.redirect('/recuperar-senha?error=nao-encontrado')
        }

        await usuario.findByIdAndUpdate(user._id, { senha: senha })
        return res.redirect('/login?senha=ok')
    }catch(err){
        console.error(err)
        return res.redirect('/recuperar-senha?error=server')
    }
}

export async function abreindex(req, res){
    if (req.session && req.session.usuario) {
        if (req.session.usuario.admin) {
            return res.redirect('/admin/usuarios/lst')
        }
        return res.redirect('/home')
    }
    // homepage can include summaries or links
    const procedimentoCount = await Procedimento.countDocuments({ publicado: true })
    const medicamentoCount = await Medicamento.countDocuments({ publicado: true })
    const termoCount = await Terminologia.countDocuments({ publicado: true })
    res.render('public/index.ejs', {
        procedimentoCount,
        medicamentoCount,
        termoCount
    })
}

export async function abrehome(req, res){
    if (req.session && req.session.usuario && req.session.usuario.admin) {
        return res.redirect('/admin/usuarios/lst')
    }
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) {
        return res.redirect('/login')
    }
    const procedimentoCount = await Procedimento.countDocuments({ publicado: true })
    const medicamentoCount = await Medicamento.countDocuments({ publicado: true })
    const termoCount = await Terminologia.countDocuments({ publicado: true })
    const quizCount = await Quiz.countDocuments({ publicado: true })
    const conteudosRecentes = await Conteudo.find({ usuario: usuarioId })
        .sort({ criadoEm: -1, _id: -1 })
        .limit(3)
    res.render('public/home.ejs', {
        procedimentoCount,
        medicamentoCount,
        termoCount,
        quizCount,
        conteudosRecentes
    })
}

export async function abreusuario(req, res){
    let dadosUsuario = null
    const usuarioId = req.session?.usuario?.id
    if (usuarioId) {
        dadosUsuario = await usuario.findById(usuarioId)
    }
    if (!dadosUsuario) {
        return res.redirect('/login')
    }
    if (dadosUsuario.telefone) {
        dadosUsuario.telefone = formatTelefoneBR(dadosUsuario.telefone)
    }
    const procedimentoCount = await Procedimento.countDocuments({ publicado: true })
    const medicamentoCount = await Medicamento.countDocuments({ publicado: true })
    const termoCount = await Terminologia.countDocuments({ publicado: true })
    const quizCount = await Quiz.countDocuments({ publicado: true })
    const conteudosCount = await Conteudo.countDocuments({ usuario: usuarioId })
    const conteudosRecentes = await Conteudo.find({ usuario: usuarioId })
        .sort({ criadoEm: -1, _id: -1 })
        .limit(5)
    res.render('public/usuario.ejs', {
        dadosUsuario,
        procedimentoCount,
        medicamentoCount,
        termoCount,
        quizCount,
        conteudosCount,
        conteudosRecentes
    })
}

export async function abreEditarUsuario(req, res){
    if (!req.session || !req.session.usuario) {
        return res.redirect('/login')
    }
    const dadosUsuario = await usuario.findById(req.session.usuario.id)
    if (!dadosUsuario) {
        return res.redirect('/login')
    }
    if (dadosUsuario.telefone) {
        dadosUsuario.telefone = formatTelefoneBR(dadosUsuario.telefone)
    }
    res.render('public/usuario-editar.ejs', {
        dadosUsuario,
        erro: req.query.erro
    })
}

export async function editarUsuario(req, res){
    if (!req.session || !req.session.usuario) {
        return res.redirect('/login')
    }
    try{
        const dadosUsuario = await usuario.findById(req.session.usuario.id)
        if (!dadosUsuario) {
            return res.redirect('/login')
        }
        let telefoneNormalizado = ''
        try {
            telefoneNormalizado = normalizeTelefoneBR(req.body.telefone)
        } catch (e) {
            if (e && e.code === 'telefone_invalido') {
                return res.redirect('/usuario/editar?erro=telefone')
            }
            throw e
        }
        const atualizacao = {
            nome: req.body.nome,
            email: req.body.email,
            endereco: req.body.endereco,
            telefone: telefoneNormalizado,
            cpf: req.body.cpf,
            datanasc: req.body.datanasc
        }
        if (req.body.senha && String(req.body.senha).trim()) {
            atualizacao.senha = req.body.senha
        }
        if (req.file && req.file.filename) {
            atualizacao.foto = req.file.filename
        }
        const usuarioAtualizado = await usuario.findByIdAndUpdate(
            req.session.usuario.id,
            atualizacao,
            { new: true }
        )
        req.session.usuario = {
            id: usuarioAtualizado._id.toString(),
            nome: usuarioAtualizado.nome,
            email: usuarioAtualizado.email,
            admin: usuarioAtualizado.admin
        }
        return res.redirect('/usuario')
    }catch(err){
        console.error(err)
        if(err.code === 11000){
            return res.redirect('/usuario/editar?erro=email')
        }
        return res.redirect('/usuario/editar?erro=salvar')
    }
}

export async function listarProcedimentos(req,res){
    const pesquisar = (req.query.pesquisar || '').trim()
    const filtro = { publicado: true }

    if (pesquisar) {
        const busca = new RegExp(pesquisar, 'i')
        filtro.$or = [
            { nome: busca },
            { descricao: busca },
            { categoria: busca }
        ]
    }

    const procedimentos = await Procedimento.find(filtro)
    res.render('public/procedimentos.ejs',{
        Procedimentos:procedimentos,
        pesquisar
    })
}

export async function listarMedicamentos(req,res){
    const pesquisar = (req.query.pesquisar || '').trim()
    const classe = (req.query.classe || '').trim()
    const filtro = { publicado: true }

    if (classe) {
        filtro.classe = new RegExp(`^${classe}$`, 'i')
    }

    if (pesquisar) {
        const busca = new RegExp(pesquisar, 'i')
        filtro.$or = [
            { principioAtivo: busca },
            { nomeComercial: busca },
            { classe: busca },
            { via: busca },
            { diluicao: busca },
            { nome: busca },
            { descricao: busca }
        ]
    }

    const medicamentos = await Medicamento.find(filtro).sort({ classe: 1, nomeComercial: 1, nome: 1 })
    const classes = await Medicamento.distinct('classe', { publicado: true, classe: { $nin: [null, ''] } })
    classes.sort((a, b) => a.localeCompare(b, 'pt-BR'))

    res.render('public/medicamentos.ejs',{
        Medicamentos:medicamentos,
        pesquisar,
        classes,
        classeSelecionada: classe
    })
}

export async function listarTerminologias(req,res){
    const pesquisar = (req.query.pesquisar || '').trim()
    const categoria = (req.query.categoria || '').trim()
    const filtro = { publicado: true }

    function escapeRegExp(texto) {
        return String(texto || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    if (categoria) {
        filtro.categoria = new RegExp(`^${escapeRegExp(categoria)}$`, 'i')
    }

    if (pesquisar) {
        const busca = new RegExp(pesquisar, 'i')
        filtro.$or = [
            { termo: busca },
            { definicao: busca },
            { categoria: busca }
        ]
    }

    const termos = await Terminologia.find(filtro).sort({ termo: 1 })

    const categorias = await Terminologia.distinct('categoria', { publicado: true, categoria: { $nin: [null, ''] } })
    categorias.sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const totalTermos = await Terminologia.countDocuments({ publicado: true })
    const totalCategorias = categorias.length

    const ultimaAtualizacao = await Terminologia.findOne({ publicado: true, publicadoEm: { $ne: null } })
        .sort({ publicadoEm: -1, _id: -1 })
        .select({ publicadoEm: 1 })
        .lean()
    const atualizadoEm = ultimaAtualizacao?.publicadoEm ? new Date(ultimaAtualizacao.publicadoEm).toLocaleDateString('pt-BR') : undefined

    res.render('public/terminologias.ejs',{
        Termos:termos,
        pesquisar,
        categorias,
        categoriaSelecionada: categoria,
        totalTermos,
        totalCategorias,
        atualizadoEm
    })
}

const MAX_PDF_CHARS = 20000
const MIN_PDF_CHARS = 300
const MAX_QUESTOES = 12
const MOCK_LIMIT = 8
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
    return {
        httpCode: typeof code === 'number' ? code : undefined,
        status: typeof status === 'string' ? status : undefined,
        message: typeof apiMessage === 'string' ? apiMessage : undefined
    }
}

function isErroAltaDemandaGemini(err) {
    const detalhes = extrairDetalhesErroGemini(err)
    if (detalhes.httpCode === 503) return true
    if (detalhes.status === 'UNAVAILABLE') return true
    const msg = String(err?.message || '')
    return msg.includes('"code":503') || msg.includes('"status":"UNAVAILABLE"')
}

function normalizarPerguntas(payload) {
    const perguntasBrutas = Array.isArray(payload?.perguntas) ? payload.perguntas : []
    const perguntas = []
    for (const p of perguntasBrutas) {
        const pergunta = String(p?.pergunta || '').trim()
        const opcoes = Array.isArray(p?.opcoes) ? p.opcoes.map((o) => String(o || '').trim()).filter(Boolean) : []
        const correta = Number.isInteger(p?.correta) ? p.correta : parseInt(p?.correta, 10)
        const categoria = String(p?.categoria || 'Gerado por PDF').trim() || 'Gerado por PDF'
        if (!pergunta || opcoes.length < 2 || Number.isNaN(correta) || correta < 0 || correta >= opcoes.length) {
            continue
        }
        perguntas.push({ pergunta, opcoes, correta, categoria })
        if (perguntas.length >= MAX_QUESTOES) break
    }
    return perguntas
}

function gerarQuizMock(textoBase) {
    const palavras = textoBase
        .toLowerCase()
        .replace(/[^a-zà-ú0-9\s]/gi, ' ')
        .split(/\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 5)
    const unicas = [...new Set(palavras)]
    const total = Math.max(3, Math.min(MOCK_LIMIT, unicas.length))
    const perguntas = []
    for (let i = 0; i < total; i += 1) {
        const termo = unicas[i] || `conteudo${i + 1}`
        const opcoes = [
            termo,
            `${termo}x`,
            `${termo}y`,
            `${termo}z`
        ]
        perguntas.push({
            pergunta: `Qual termo aparece no texto?`,
            opcoes,
            correta: 0,
            categoria: 'Teste (Mock)'
        })
    }
    return perguntas
}

async function gerarQuizComGemini(textoBase) {
    if (!process.env.GEMINI_API_KEY) {
        const erro = new Error('GEMINI_API_KEY não configurada')
        erro.code = 'sem_chave'
        throw erro
    }

    const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const prompt = [
        'Você é um gerador de questões de enfermagem.',
        'Use somente o conteúdo fornecido para criar perguntas objetivas.',
        'Responda apenas com JSON válido, sem nenhum texto extra.',
        '',
        'Crie entre 8 e 12 questões de múltipla escolha.',
        'Cada questão deve ter 4 alternativas e apenas 1 correta.',
        'Responda no formato:',
        '{"perguntas":[{"pergunta":"...","opcoes":["A","B","C","D"],"correta":0,"categoria":"Sistema ou tema"}]}',
        'Texto base:',
        textoBase
    ].join('\n')

    let resposta
    const delays = [500, 1500, 3000]
    for (let tentativa = 0; tentativa < delays.length; tentativa += 1) {
        try {
            resposta = await geminiClient.models.generateContent({
                model: modelo,
                contents: prompt
            })
            break
        } catch (err) {
            const altaDemanda = isErroAltaDemandaGemini(err)
            if (altaDemanda && tentativa < delays.length - 1) {
                await sleep(delays[tentativa])
                continue
            }
            const detalhes = extrairDetalhesErroGemini(err)
            const erro = new Error(`Gemini API erro: ${err?.message || err}`, { cause: err })
            erro.code = 'api'
            if (detalhes.httpCode) erro.apiHttpCode = detalhes.httpCode
            if (detalhes.status) erro.apiStatus = detalhes.status
            if (detalhes.message) erro.apiMessage = detalhes.message
            throw erro
        }
    }

    const textoResposta = typeof resposta?.text === 'string' ? resposta.text : ''
    const payload = extrairJsonDoTexto(textoResposta)
    const perguntas = normalizarPerguntas(payload)
    if (!perguntas.length) {
        const erro = new Error('Resposta sem perguntas válidas')
        erro.code = 'parse'
        throw erro
    }
    return perguntas
}

export async function fazerQuiz(req,res){
    const sistema = (req.query.sistema || '').trim()
    const uploadStatus = (req.query.upload || '').trim()
    const uploadCount = parseInt(req.query.novas, 10)
    const mockMode = isMockMode()
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) {
        return res.redirect('/login')
    }
    const filtro = { publicado: true, usuario: usuarioId }
    if (sistema) {
        filtro.categoria = new RegExp(`^${sistema}$`, 'i')
    }

    const perguntas = await Quiz.find(filtro).sort({ categoria: 1, _id: 1 })
    const perguntasAdmin = perguntas.filter((q) => q.tipo !== 'ia')
    const perguntasIA = perguntas.filter((q) => q.tipo === 'ia')
    const sistemas = await Quiz.distinct('categoria', {
        publicado: true,
        usuario: usuarioId,
        categoria: { $nin: [null, ''] }
    })
    sistemas.sort((a, b) => a.localeCompare(b, 'pt-BR'))

    res.render('public/quiz.ejs',{
        perguntasAdmin,
        perguntasIA,
        sistemas,
        sistemaSelecionado: sistema,
        uploadStatus,
        uploadCount: Number.isNaN(uploadCount) ? 0 : uploadCount,
        aiEnabled: Boolean(process.env.GEMINI_API_KEY) || mockMode,
        mockMode
    })
}


export async function listarConteudos(req, res) {
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) return res.redirect('/login')

    const categoria = (req.query.categoria || '').trim()
    const q = (req.query.q || '').trim()
    const filtro = { usuario: usuarioId }

    if (categoria) {
        filtro.categoria = new RegExp(`^${categoria}$`, 'i')
    }
    if (q) {
        const busca = new RegExp(q, 'i')
        filtro.$or = [
            { titulo: busca },
            { categoria: busca },
            { descricao: busca },
            { arquivoOriginal: busca }
        ]
    }

    const conteudos = await Conteudo.find(filtro).sort({ criadoEm: -1, _id: -1 })
    const categorias = await Conteudo.distinct('categoria', {
        usuario: usuarioId,
        categoria: { $nin: [null, ''] }
    })
    categorias.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))

    res.render('public/conteudos.ejs', {
        Conteudos: conteudos,
        categorias,
        categoriaSelecionada: categoria,
        q,
        erro: req.query.erro,
        sucesso: req.query.sucesso,
        editando: false,
        ConteudoEdicao: null
    })
}

export async function uploadConteudo(req, res) {
    try {
        const usuarioId = req.session?.usuario?.id
        if (!usuarioId) return res.redirect('/login')
        if (!req.file) return res.redirect('/conteudos?erro=arquivo')

        const tituloRaw = (req.body.titulo || '').trim()
        const categoria = (req.body.categoria || '').trim()
        const descricao = (req.body.descricao || '').trim()

        const nomeBase = String(req.file.originalname || 'PDF')
            .replace(/\.pdf$/i, '')
            .trim()
        const titulo = tituloRaw || nomeBase || 'PDF sem título'

        await Conteudo.create({
            usuario: usuarioId,
            titulo,
            categoria: categoria || null,
            descricao: descricao || null,
            arquivoNome: req.file.filename,
            arquivoOriginal: req.file.originalname,
            mimeType: req.file.mimetype,
            tamanho: req.file.size
        })
        return res.redirect('/conteudos?sucesso=upload')
    } catch (err) {
        console.error(err)
        if (req.file && req.session?.usuario?.id) {
            const caminho = uploadPath('uploads', 'conteudos', req.session.usuario.id, req.file.filename)
            try {
                await fs.unlink(caminho)
            } catch (e) {
                // ignora
            }
        }
        return res.redirect('/conteudos?erro=salvar')
    }
}

export async function abreEditarConteudo(req, res) {
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) return res.redirect('/login')

    const conteudos = await Conteudo.find({ usuario: usuarioId }).sort({ criadoEm: -1, _id: -1 })
    const conteudo = await Conteudo.findOne({ _id: req.params.id, usuario: usuarioId })
    if (!conteudo) return res.redirect('/conteudos')

    const categorias = await Conteudo.distinct('categoria', {
        usuario: usuarioId,
        categoria: { $nin: [null, ''] }
    })
    categorias.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))

    return res.render('public/conteudos.ejs', {
        Conteudos: conteudos,
        categorias,
        categoriaSelecionada: '',
        q: '',
        erro: req.query.erro,
        sucesso: null,
        editando: true,
        ConteudoEdicao: conteudo
    })
}

export async function editarConteudo(req, res) {
    try {
        const usuarioId = req.session?.usuario?.id
        if (!usuarioId) return res.redirect('/login')

        const titulo = (req.body.titulo || '').trim()
        if (!titulo) return res.redirect(`/conteudos/edt/${req.params.id}?erro=titulo`)

        const categoria = (req.body.categoria || '').trim()
        const descricao = (req.body.descricao || '').trim()

        const atualizado = await Conteudo.findOneAndUpdate({
            _id: req.params.id,
            usuario: usuarioId
        }, {
            titulo,
            categoria: categoria || null,
            descricao: descricao || null
        })
        if (!atualizado) return res.redirect('/conteudos')
        return res.redirect('/conteudos?sucesso=editado')
    } catch (err) {
        console.error(err)
        return res.redirect(`/conteudos/edt/${req.params.id}?erro=salvar`)
    }
}

export async function downloadConteudo(req, res) {
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) return res.redirect('/login')

    const conteudo = await Conteudo.findOne({ _id: req.params.id, usuario: usuarioId })
    if (!conteudo) return res.redirect('/conteudos?erro=nao-encontrado')

    const caminho = uploadPath('uploads', 'conteudos', usuarioId, conteudo.arquivoNome)
    return res.download(caminho, conteudo.arquivoOriginal, (err) => {
        if (err) {
            console.error(err)
            try {
                if (!res.headersSent) return res.redirect('/conteudos?erro=arquivo')
            } catch (e) {}
        }
    })
}

export async function deletarConteudo(req, res) {
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) return res.redirect('/login')

    const conteudo = await Conteudo.findOneAndDelete({ _id: req.params.id, usuario: usuarioId })
    if (conteudo) {
        const caminho = uploadPath('uploads', 'conteudos', usuarioId, conteudo.arquivoNome)
        try {
            await fs.unlink(caminho)
        } catch (err) {
            // ignora se já não existir
        }
    }
    return res.redirect('/conteudos?sucesso=excluido')
}

export async function responderQuiz(req,res){
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) {
        return res.redirect('/login')
    }
    const respostas = req.body.respostas || {}
    const ids = Object.keys(respostas).filter((key) => String(key || '').trim())

    if (ids.length === 0) {
        return res.render('public/quiz-result.ejs',{
            total: 0,
            corretas: 0,
            erradas: 0,
            sistemas: []
        })
    }

    const perguntas = await Quiz.find({
        _id: { $in: ids },
        publicado: true,
        usuario: usuarioId
    })
    let corretas = 0
    let erradas = 0
    const porSistema = {}
    const errosDetalhes = []

    perguntas.forEach((p) => {
        const sistema = (p.categoria && p.categoria.trim()) ? p.categoria.trim() : 'Sem sistema'
        if (!porSistema[sistema]) {
            porSistema[sistema] = { nome: sistema, total: 0, corretas: 0, erradas: 0 }
        }
        porSistema[sistema].total += 1

        const escolhaRaw = respostas[String(p._id)]
        const escolha = escolhaRaw !== undefined ? parseInt(escolhaRaw, 10) : NaN
        const acertou = escolha === p.correta

        if (acertou) {
            corretas += 1
            porSistema[sistema].corretas += 1
        } else {
            erradas += 1
            porSistema[sistema].erradas += 1
            const corretaTexto = (p.opcoes && Number.isInteger(p.correta) && p.opcoes[p.correta])
                ? p.opcoes[p.correta]
                : 'Resposta correta não encontrada'
            const escolhaTexto = (p.opcoes && Number.isInteger(escolha) && p.opcoes[escolha])
                ? p.opcoes[escolha]
                : 'Não respondida'
            errosDetalhes.push({
                pergunta: p.pergunta,
                sistema,
                corretaTexto,
                escolhaTexto
            })
        }
    })

    const sistemas = Object.values(porSistema).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    res.render('public/quiz-result.ejs',{
        total: perguntas.length,
        corretas,
        erradas,
        sistemas,
        errosDetalhes
    })
}

export async function receberQuizPdf(req, res) {
    if (!req.file) {
        return res.redirect('/quiz?upload=erro')
    }
    const usuarioId = req.session?.usuario?.id
    if (!usuarioId) {
        return res.redirect('/login')
    }

    const mockMode = isMockMode()
    if (!process.env.GEMINI_API_KEY && !mockMode) {
        return res.redirect('/quiz?upload=sem-chave')
    }

    const caminho = req.file.path

        const buffer = await fs.readFile(caminho)
        const pdfData = await pdfParse(buffer)
        const textoCru = String(pdfData?.text || '')
        const textoLimpo = textoCru.replace(/\s+/g, ' ').trim()

        if (textoLimpo.length < MIN_PDF_CHARS) {
            return res.redirect('/quiz?upload=pdf-vazio')
        }

        const textoBase = textoLimpo.length > MAX_PDF_CHARS
            ? textoLimpo.slice(0, MAX_PDF_CHARS)
            : textoLimpo

       let perguntas = [];

try {
    if (mockMode) {
        perguntas = gerarQuizMock(textoBase);
    } else {
        perguntas = await gerarQuizComGemini(textoBase);
    }
} catch (err) {
    console.error('Erro ao gerar quiz (Gemini):', err);

    // fallback automático (NÃO quebra sistema)
    perguntas = gerarQuizMock(textoBase);
}

// validação de segurança
if (!Array.isArray(perguntas) || perguntas.length === 0) {
    return res.redirect('/quiz?upload=sem-questoes');
}

const agora = new Date();

const documentos = perguntas
    .filter(p => p?.pergunta && Array.isArray(p?.opcoes) && p.opcoes.length >= 2)
    .map((p) => ({
        usuario: usuarioId,
        pergunta: p.pergunta,
        opcoes: p.opcoes,
        correta: Number.isInteger(p.correta) ? p.correta : 0,
        categoria: p.categoria || 'Gerado por PDF',
        tipo: 'ia',
        publicado: true,
        publicadoEm: agora
    }));

if (documentos.length === 0) {
    return res.redirect('/quiz?upload=sem-dados');
}

await Quiz.insertMany(documentos);

return res.redirect(`/quiz?upload=ok&novas=${documentos.length}`);}