import mongoose from 'mongoose';

const url = "mongodb+srv://vcaroline1507:<@Lc124550>@cluster0.uww0rts.mongodb.net/?appName=Cluster0";
const conexao = await mongoose.connect('mongodb://localhost:27017/ifstore')

export default conexao