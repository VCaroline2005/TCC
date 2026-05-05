import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ifstore'
const conexao = await mongoose.connect(uri)

export default conexao
