import conexao from '../config/conexao.js'

const Usuario = conexao.Schema({
    nome: {type:String, required:true},
    email: {type:String, required:true, unique:true},
    senha: {type:String, required:true},
    foto: 'String',
    endereco: 'String',
    telefone: 'String',
    cpf: 'String',
    admin: {type:Boolean, default:false},
    datanasc: { type: Date, default: Date.now },
})

export default conexao.model('Usuario',Usuario)
