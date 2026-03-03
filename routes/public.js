import express from 'express';
const router = express.Router();
import multer from 'multer';
const upload = multer({ dest: 'public/usuarios/' })

import { abrecadastro, cadastro, abrelogin, login, abreindex,
         listarProcedimentos, listarMedicamentos, listarTerminologias,
         fazerQuiz, responderQuiz, salvarNota, listarNotas, adicionarLembrete, listarLembretes
 } from '../controllers/public.js';

router.get('/cadastro', abrecadastro)

router.post('/cadastro', upload.single('foto'), cadastro)

router.get('/login', abrelogin)

router.post('/login', login)

// atalhos compatíveis com caminhos que apontam para /site
router.get('/site/login', abrelogin)
router.post('/site/login', login)

router.get('/', abreindex)

// nursing-specific pages
router.get('/procedimentos', listarProcedimentos)
router.get('/medicamentos', listarMedicamentos)
router.get('/terminologias', listarTerminologias)
router.get('/quiz', fazerQuiz)
router.post('/quiz/answer', responderQuiz)

// notas e lembretes
router.get('/notas', listarNotas)
router.post('/notas', salvarNota)
router.get('/lembretes', listarLembretes)
router.post('/lembretes', adicionarLembrete)

export default router