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
        if (isAdmin) {
            return res.redirect('/admin/usuarios/lst')
        }
        return res.redirect('/usuario')
    }catch(err){
        console.error(err)
        return res.render('login', { error: 'Erro no servidor.' })
    }
}

export async function abreindex(req, res){
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

export async function abreusuario(req, res){
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
        procedimentoCount,
        medicamentoCount,
        termoCount,
        quizCount,
        lembretesProximos,
        agora
    })
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
    const perguntas = await Quiz.find({ publicado: true })
    // choose random question
    const idx = Math.floor(Math.random() * perguntas.length);
    const pergunta = perguntas[idx];
    res.render('public/quiz.ejs',{Pergunta:pergunta})
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
        erro:req.query.erro
    })
}

export async function responderQuiz(req,res){
    const pergunta = await Quiz.findOne({ _id: req.body.id, publicado: true })
    let correto = false;
    if(pergunta && parseInt(req.body.escolha,10) === pergunta.correta){
        correto = true;
    }
    res.render('public/quiz-result.ejs',{pergunta, correto});
}
