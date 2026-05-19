import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb+srv://vcaroline1507_db_user:12345@cluster0.1uswese.mongodb.net/?appName=Cluster0'
const conexao = await mongoose.connect(uri)

export default conexao;