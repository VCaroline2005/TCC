import usuario from '../models/usuario.js'
import Procedimento from '../models/procedimento.js'
import Medicamento from '../models/medicamento.js'
import Terminologia from '../models/terminologia.js'
import Quiz from '../models/quiz.js'
import Lembrete from '../models/lembrete.js'
import fs from 'node:fs/promises'
import pdfParse from 'pdf-parse'
import { GoogleGenAI } from '@google/genai'

export async function abrecadastro(req, res){
    res.render('cadastro')
}

export async function cadastro(req, res){
    try{
        const admin = req.body.espaco === 'admin';
        const foto = req.file ? req.file.filename : null;

        const novousuario = new usuario({
            nome: req.body.nome,
            email: req.body.email,
            senha: req.body.senha,
            endereco: req.body.endereco,
            foto: foto,
            telefone: req.body.telefone,
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
    res.render('login', { cadastro: req.query.cadastro })
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
    const procedimentoCount = await Procedimento.countDocuments({ publicado: true })
    const medicamentoCount = await Medicamento.countDocuments({ publicado: true })
    const termoCount = await Terminologia.countDocuments({ publicado: true })
    const agora = new Date()
    const limite = new Date()
    limite.setDate(limite.getDate() + 3)
    const lembretesProximos = await Lembrete.find({
        vencimento: { $lte: limite }
    }).sort({ vencimento: 1 })
    res.render('public/home.ejs', {
        procedimentoCount,
        medicamentoCount,
        termoCount,
        lembretesProximos,
        agora
    })
}

export async function abreusuario(req, res){
    let dadosUsuario = null
    if (req.session && req.session.usuario && req.session.usuario.id) {
        dadosUsuario = await usuario.findById(req.session.usuario.id)
    }
    const procedimentoCount = await Procedimento.countDocuments({ publicado: true })
    const medicamentoCount = await Medicamento.countDocuments({ publicado: true })
    const termoCount = await Terminologia.countDocuments({ publicado: true })
    const quizCount = await Quiz.countDocuments({ publicado: true })
    const agora = new Date()
    const limite = new Date()
    limite.setDate(limite.getDate() + 3)
    const lembretesProximos = await Lembrete.find({
        vencimento: { $lte: limite }
    }).sort({ vencimento: 1 })
    res.render('public/usuario.ejs', {
        dadosUsuario,
        procedimentoCount,
        medicamentoCount,
        termoCount,
        quizCount,
        lembretesProximos,
        agora
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
        const atualizacao = {
            nome: req.body.nome,
            email: req.body.email,
            endereco: req.body.endereco,
            telefone: req.body.telefone,
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
    const filtro = { publicado: true }

    if (pesquisar) {
        const busca = new RegExp(pesquisar, 'i')
        filtro.$or = [
            { termo: busca },
            { definicao: busca },
            { categoria: busca }
        ]
    }

    const termos = await Terminologia.find(filtro)
    res.render('public/terminologias.ejs',{
        Termos:termos,
        pesquisar
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
    try {
        resposta = await geminiClient.models.generateContent({
            model: modelo,
            contents: prompt
        })
    } catch (err) {
        const erro = new Error(`Gemini API erro: ${err?.message || err}`)
        erro.code = 'api'
        throw erro
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
    const filtro = { publicado: true }
    if (sistema) {
        filtro.categoria = new RegExp(`^${sistema}$`, 'i')
    }

    const perguntas = await Quiz.find(filtro).sort({ categoria: 1, _id: 1 })
    const sistemas = await Quiz.distinct('categoria', { publicado: true, categoria: { $nin: [null, ''] } })
    sistemas.sort((a, b) => a.localeCompare(b, 'pt-BR'))

    res.render('public/quiz.ejs',{
        Perguntas:perguntas,
        sistemas,
        sistemaSelecionado: sistema,
        uploadStatus,
        uploadCount: Number.isNaN(uploadCount) ? 0 : uploadCount,
        aiEnabled: Boolean(process.env.GEMINI_API_KEY) || mockMode,
        mockMode
    })
}


export async function adicionarLembrete(req,res){
    try{
        const conteudo = (req.body.conteudo || '').trim()
        if(!conteudo){
            return res.redirect('/lembretes?erro=conteudo')
        }
        await Lembrete.create({usuario:req.body.usuario, conteudo, vencimento:req.body.vencimento})
        return res.redirect('/lembretes')
    }catch(err){
        console.error(err)
        return res.redirect('/lembretes?erro=salvar')
    }
}

export async function listarLembretes(req,res){
    const lembretes = await Lembrete.find({})
    res.render('public/lembretes.ejs',{
        Lembretes:lembretes,
        erro:req.query.erro,
        editando: false,
        LembreteEdicao: null
    })
}

export async function abreEditarLembrete(req,res){
    const lembretes = await Lembrete.find({})
    const lembrete = await Lembrete.findById(req.params.id)
    if (!lembrete) {
        return res.redirect('/lembretes')
    }
    res.render('public/lembretes.ejs',{
        Lembretes:lembretes,
        erro:req.query.erro,
        editando: true,
        LembreteEdicao: lembrete
    })
}

export async function editarLembrete(req,res){
    try{
        const conteudo = (req.body.conteudo || '').trim()
        if(!conteudo){
            return res.redirect(`/lembretes/edt/${req.params.id}?erro=conteudo`)
        }
        await Lembrete.findByIdAndUpdate(req.params.id, {
            conteudo,
            vencimento: req.body.vencimento
        })
        return res.redirect('/lembretes')
    }catch(err){
        console.error(err)
        return res.redirect(`/lembretes/edt/${req.params.id}?erro=salvar`)
    }
}

export async function deletarLembrete(req,res){
    await Lembrete.findByIdAndDelete(req.params.id)
    res.redirect('/lembretes')
}

export async function responderQuiz(req,res){
    const respostas = req.body.respostas || {}
    const ids = Array.isArray(req.body.perguntas)
        ? req.body.perguntas
        : (req.body.perguntas ? [req.body.perguntas] : [])

    if (ids.length === 0) {
        return res.render('public/quiz-result.ejs',{
            total: 0,
            corretas: 0,
            erradas: 0,
            sistemas: []
        })
    }

    const perguntas = await Quiz.find({ _id: { $in: ids }, publicado: true })
    let corretas = 0
    let erradas = 0
    const porSistema = {}

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
        }
    })

    const sistemas = Object.values(porSistema).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    res.render('public/quiz-result.ejs',{
        total: perguntas.length,
        corretas,
        erradas,
        sistemas
    })
}

export async function receberQuizPdf(req, res) {
    if (!req.file) {
        return res.redirect('/quiz?upload=erro')
    }

    const mockMode = isMockMode()
    if (!process.env.GEMINI_API_KEY && !mockMode) {
        return res.redirect('/quiz?upload=sem-chave')
    }

    const caminho = req.file.path
    try {
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

        const perguntas = mockMode
            ? gerarQuizMock(textoBase)
            : await gerarQuizComGemini(textoBase)
        const agora = new Date()
        const documentos = perguntas.map((p) => ({
            pergunta: p.pergunta,
            opcoes: p.opcoes,
            correta: p.correta,
            categoria: p.categoria,
            publicado: true,
            publicadoEm: agora
        }))

        await Quiz.insertMany(documentos)
        return res.redirect(`/quiz?upload=ok&novas=${documentos.length}`)
    } catch (err) {
        console.error(err)
        if (err?.code === 'parse') {
            return res.redirect('/quiz?upload=gerar')
        }
        if (err?.code === 'api') {
            return res.redirect('/quiz?upload=api')
        }
        return res.redirect('/quiz?upload=erro')
    } finally {
        try {
            await fs.unlink(caminho)
        } catch (err) {
            // ignore
        }
    }
}
