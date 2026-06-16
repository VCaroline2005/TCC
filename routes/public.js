import express from 'express';
const router = express.Router();
import multer from 'multer';
import fs from 'node:fs'
import { ensureUploadPath, uploadPath } from '../utils/uploadPaths.js'

const upload = multer({ dest: ensureUploadPath('usuarios') })

function pdfOnlyFilter(req, file, cb) {
    const isPdfMime = file.mimetype === 'application/pdf'
    const isPdfExt = (file.originalname || '').toLowerCase().endsWith('.pdf')
    if (isPdfMime || isPdfExt) return cb(null, true)
    return cb(new Error('Apenas arquivos PDF são permitidos.'))
}

const conteudoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const usuarioId = req.session?.usuario?.id
        if (!usuarioId) return cb(new Error('Usuário não autenticado.'))
        const dir = uploadPath('uploads', 'conteudos', usuarioId)
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir))
    },
    filename: (req, file, cb) => {
        const stamp = Date.now()
        const rand = Math.round(Math.random() * 1e9)
        cb(null, `${stamp}-${rand}.pdf`)
    }
})

const conteudoUpload = multer({
    storage: conteudoStorage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: pdfOnlyFilter
})

const quizUpload = multer({
    dest: ensureUploadPath('uploads', 'quiz'),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: pdfOnlyFilter
})

import { abrecadastro, cadastro, abrelogin, login, abreindex, abrehome,
         listarProcedimentos, listarMedicamentos, listarTerminologias,
         fazerQuiz, responderQuiz, listarConteudos, uploadConteudo,
         downloadConteudo, abreEditarConteudo, editarConteudo, deletarConteudo,
         abreusuario, sair,
         abreEditarUsuario, editarUsuario, receberQuizPdf,
         abreRecuperarSenha, recuperarSenha
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
router.get('/recuperar-senha', abreRecuperarSenha)
router.post('/recuperar-senha', recuperarSenha)

// atalhos compatíveis com caminhos que apontam para /site
router.get('/site/login', abrelogin)
router.post('/site/login', login)
router.get('/site/recuperar-senha', abreRecuperarSenha)
router.post('/site/recuperar-senha', recuperarSenha)

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

// conteúdos (PDF)

router.get('/conteudos', requireLogin, listarConteudos)
router.post('/conteudos/upload', requireLogin, (req, res, next) => {
    conteudoUpload.single('arquivo')(req, res, (err) => {
        if (err) {
            return res.redirect('/conteudos?erro=arquivo')
        }
        return next()
    })
}, uploadConteudo)
router.get('/conteudos/dl/:id', requireLogin, downloadConteudo)
router.get('/conteudos/edt/:id', requireLogin, abreEditarConteudo)
router.post('/conteudos/edt/:id', requireLogin, editarConteudo)
router.get('/conteudos/del/:id', requireLogin, deletarConteudo)

export default router
