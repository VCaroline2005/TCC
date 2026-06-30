import 'dotenv/config'
//importa a biblioteca express
import express from 'express';
import session from 'express-session';
import { uploadPublicRoot } from '../utils/uploadPaths.js'
//inicializa a aplicação usando a bibliotea express
const app = express();
//cria uma variável com o número da porta
const port = parseInt(process.env.PORT || '3001', 10);

//configura o node para usar ejs como view (visão)
app.set('view engine', 'ejs');
//configura o node para receber dados dos formulários
app.use(express.urlencoded({ extended: true }));
//configura a pasta de arquivos estáticos (fotos, vídeos ...)
app.use(express.static(uploadPublicRoot));
//sessões (mantém login entre páginas)
app.set('trust proxy', 1)
app.use(session({
    name: 'ifstore.sid',
    secret: process.env.SESSION_SECRET || 'ifstore-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        sameSite: 'lax'
    }
}))
// deixa o usuário disponível nas views
app.use((req, res, next) => {
    res.locals.usuario = req.session?.usuario || null
    res.locals.currentPath = req.path
    next()
})

function requireAdminRoute(req, res, next) {
    if (req.session?.usuario?.admin === true) {
        return next()
    }

    const nextUrl = encodeURIComponent(req.originalUrl || '/admin')
    return res.redirect(`/admin/login?next=${nextUrl}`)
}

//importa os arquivos de rotas (os endereços são cadastrados neles)
import publicroutes from '../routes/public.js';
import adminroutes from '../routes/admin.js';
import { abreedtquiz, edtquiz } from '../controllers/admin.js';

//usa os arquivos de rotas
app.use(publicroutes);
app.use(adminroutes);
// rota direta de edição de quiz (garante acesso mesmo se o router admin não recarregar)
app.get('/admin/quiz/edt/:id', requireAdminRoute, abreedtquiz);
app.post('/admin/quiz/edt/:id', requireAdminRoute, edtquiz);

//faz a aplicação ficar escurando a porta cadastrada
const server = app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`)
});
server.on('error', (err) => {
    console.error('Erro ao iniciar servidor:', err?.code || err?.message || err)
})
