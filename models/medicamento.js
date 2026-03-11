import conexao from '../config/conexao.js'

const Medicamento = conexao.Schema({
    principioAtivo: {type:String},
    nomeComercial: {type:String},
    classe: {type:String},
    via: {type:String},
    diluicao: {type:String},

    // compatibilidade com estrutura antiga
    nome: {type:String, required:true},
    descricao: {type:String},
    dosagem: {type:String},
    fabricante: {type:String},

    fotos: [{type:String}],
    publicado: {type:Boolean, default:false},
    publicadoEm: {type:Date},
})

export default conexao.model('Medicamento',Medicamento)
