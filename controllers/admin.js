import Usuario from '../models/usuario.js';
import Categoria from '../models/categoria.js';
import Procedimento from '../models/procedimento.js';
import Medicamento from '../models/medicamento.js';
import Terminologia from '../models/terminologia.js';
import Quiz from '../models/quiz.js';
import Lembrete from '../models/lembrete.js'

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
    await Procedimento.findByIdAndDelete(req.params.id)
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
        principioAtivo:req.body.principioAtivo,
        nomeComercial:nomeComercial,
        classe:req.body.classe,
        via:req.body.via,
        diluicao:req.body.diluicao,
        // compatibilidade com telas antigas
        nome:nomeComercial,
        descricao:req.body.principioAtivo,
        dosagem:req.body.diluicao,
        fabricante:req.body.classe,
        fotos: req.files ? req.files.map(f=>f.filename) : []
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
    await Medicamento.findByIdAndUpdate(req.params.id, {
        principioAtivo:req.body.principioAtivo,
        nomeComercial:nomeComercial,
        classe:req.body.classe,
        via:req.body.via,
        diluicao:req.body.diluicao,
        // compatibilidade com estrutura antiga
        nome:nomeComercial,
        descricao:req.body.principioAtivo,
        dosagem:req.body.diluicao,
        fabricante:req.body.classe
    })
    res.redirect('/admin/medicamento/lst')
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
    await Quiz.create({
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
