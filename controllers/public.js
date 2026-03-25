import usuario from '../models/usuario.js'
import Procedimento from '../models/procedimento.js'
import Medicamento from '../models/medicamento.js'
import Terminologia from '../models/terminologia.js'
import Quiz from '../models/quiz.js'
import Lembrete from '../models/lembrete.js'

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

export async function fazerQuiz(req,res){
    const sistema = (req.query.sistema || '').trim()
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
        sistemaSelecionado: sistema
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
