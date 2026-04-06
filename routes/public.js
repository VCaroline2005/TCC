import express from 'express';
const router = express.Router();
import multer from 'multer';
const upload = multer({ dest: 'public/usuarios/' })
const quizUpload = multer({
    dest: 'public/uploads/quiz/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === 'application/pdf'
        const isPdfExt = (file.originalname || '').toLowerCase().endsWith('.pdf')
        if (isPdfMime || isPdfExt) {
            return cb(null, true)
        }
        return cb(new Error('Apenas arquivos PDF são permitidos.'))
    }
})

import { abrecadastro, cadastro, abrelogin, login, abreindex, abrehome,
         listarProcedimentos, listarMedicamentos, listarTerminologias,
         fazerQuiz, responderQuiz, adicionarLembrete, listarLembretes,
         abreusuario, sair, abreEditarLembrete, editarLembrete, deletarLembrete,
         abreEditarUsuario, editarUsuario, receberQuizPdf
 } from '../controllers/public.js';

function requireLogin(req, res, next) {
    if (req.session && req.session.usuario && req.session.usuario.id) {
        return next()
    }
    if (req.session) {
        req.session.destroy(() => res.redirect('/login'))
        return
    }
    return res.redirect('/login')
}

router.get('/cadastro', abrecadastro)

router.post('/cadastro', upload.single('foto'), cadastro)

router.get('/login', abrelogin)

router.post('/login', login)
router.get('/sair', sair)

// atalhos compatíveis com caminhos que apontam para /site
router.get('/site/login', abrelogin)
router.post('/site/login', login)

router.get('/', abreindex)
router.get('/home', requireLogin, abrehome)
router.get('/usuario', requireLogin, abreusuario)
router.get('/usuario/editar', requireLogin, abreEditarUsuario)
router.post('/usuario/editar', requireLogin, upload.single('foto'), editarUsuario)

// nursing-specific pages
router.get('/procedimentos', requireLogin, listarProcedimentos)
router.get('/medicamentos', requireLogin, listarMedicamentos)
router.get('/terminologias', requireLogin, listarTerminologias)
router.get('/quiz', requireLogin, fazerQuiz)
router.post('/quiz/responder', requireLogin, responderQuiz)
router.post('/quiz/upload', requireLogin, (req, res, next) => {
    quizUpload.single('arquivo')(req, res, (err) => {
        if (err) {
            return res.redirect('/quiz?upload=erro')
        }
        return next()
    })
}, receberQuizPdf)

// lembretes

router.get('/lembretes', requireLogin, listarLembretes)
router.post('/lembretes', requireLogin, adicionarLembrete)
router.get('/lembretes/edt/:id', requireLogin, abreEditarLembrete)
router.post('/lembretes/edt/:id', requireLogin, editarLembrete)
router.get('/lembretes/del/:id', requireLogin, deletarLembrete)

export default router
