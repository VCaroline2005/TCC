import usuario from '../models/usuario.js'
import Procedimento from '../models/procedimento.js'
import Medicamento from '../models/medicamento.js'
import Terminologia from '../models/terminologia.js'
import Quiz from '../models/quiz.js'
import Nota from '../models/nota.js'
import Lembrete from '../models/lembrete.js'

export async function abrecadastro(req, res){
    res.render('cadastro')
}

export async function cadastro(req, res){
    //esse comando equivale a um if
    const admin = req.body.admin=="on" ? true : false;

    const novousuario = new usuario({
        nome: req.body.nome,
        email: req.body.email,
        senha: req.body.senha,
        endereco: req.body.endereco,
        foto: req.file.filename,
        telefone: req.body.telefone,
        cpf: req.body.cpf,
        admin: admin
    })

    await novousuario.save();
    res.send("Cadastrado com sucesso!")
}

export async function abrelogin(req, res){
    res.render('login')
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

        // Autenticação simples concluída
        return res.redirect('/admin/usuarios/lst')
    }catch(err){
        console.error(err)
        return res.render('login', { error: 'Erro no servidor.' })
    }
}

export async function abreindex(req, res){
    // homepage can include summaries or links
    const procedimentoCount = await Procedimento.countDocuments()
    const medicamentoCount = await Medicamento.countDocuments()
    const termoCount = await Terminologia.countDocuments()
    res.render('public/index.ejs', {
        procedimentoCount,
        medicamentoCount,
        termoCount
    })
}

export async function listarProcedimentos(req,res){
    const procedimentos = await Procedimento.find({})
    res.render('public/procedimentos.ejs',{Procedimentos:procedimentos})
}

export async function listarMedicamentos(req,res){
    const medicamentos = await Medicamento.find({})
    res.render('public/medicamentos.ejs',{Medicamentos:medicamentos})
}

export async function listarTerminologias(req,res){
    const termos = await Terminologia.find({})
    res.render('public/terminologias.ejs',{Termos:termos})
}

export async function fazerQuiz(req,res){
    const perguntas = await Quiz.find({})
    // choose random question
    const idx = Math.floor(Math.random() * perguntas.length);
    const pergunta = perguntas[idx];
    res.render('public/quiz.ejs',{Pergunta:pergunta})
}

export async function salvarNota(req,res){
    await Nota.create({usuario:req.body.usuario, conteudo:req.body.conteudo})
    res.redirect('/notas')
}

export async function listarNotas(req,res){
    const notas = await Nota.find({})
    res.render('public/notas.ejs',{Notas:notas})
}

export async function adicionarLembrete(req,res){
    await Lembrete.create({usuario:req.body.usuario, conteudo:req.body.conteudo, vencimento:req.body.vencimento})
    res.redirect('/lembretes')
}

export async function listarLembretes(req,res){
    const lembretes = await Lembrete.find({})
    res.render('public/lembretes.ejs',{Lembretes:lembretes})
}

export async function responderQuiz(req,res){
    const pergunta = await Quiz.findById(req.body.id)
    let correto = false;
    if(pergunta && parseInt(req.body.escolha,10) === pergunta.correta){
        correto = true;
    }
    res.render('public/quiz-result.ejs',{pergunta, correto});
}