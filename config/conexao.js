import mongoose from 'mongoose';

const url = "mongodb+srv://vcaroline1507:vcaroline1507@cluster0.uww0rts.mongodb.net/";
const conexao = await mongoose.connect('mongodb://localhost:27017/ifstore')

export default conexao