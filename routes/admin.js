//importação da biblioteca express
import express from 'express'
//criação de um arquivo de rotas
const router = express.Router()
//importação da biblioteca multer para baixar arquivos
import multer from 'multer';
import fs from 'node:fs'
import { ensureUploadPath } from '../utils/uploadPaths.js'
//configuração da pasta onde serão inseridos os arquivos baixados
const upload = multer({ dest: ensureUploadPath('fotos') })
const popsUploadDir = ensureUploadPath('uploads', 'pops')

const tmpImportDir = '/tmp/ifstore-imports'
try {
    fs.mkdirSync(tmpImportDir, { recursive: true })
} catch (err) {
    // ignore (será tratado ao subir arquivo)
}

function pdfOnlyFilter(req, file, cb) {
    const isPdfMime = file.mimetype === 'application/pdf'
    const isPdfExt = (file.originalname || '').toLowerCase().endsWith('.pdf')
    if (isPdfMime || isPdfExt) return cb(null, true)
    return cb(new Error('Apenas arquivos PDF são permitidos.'))
}

const pdfUpload = multer({
    dest: tmpImportDir,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: pdfOnlyFilter
})

const popsPdfUpload = multer({
    dest: popsUploadDir,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: pdfOnlyFilter
})

//importação das funções de controllers
import {    
        abreadmin,
        abreloginadmin,
        loginadmin,
        abreedtcategoria, 
        edtcategoria, 
        listarusuarios, 
        detalhe, 
        deletarusuario,
        abreaddcategoria,
        deletacategoria, 
        addcategoria, 
        listarcategoria, 
        filtrarcategoria,
        abreaddprocedimento,
        addprocedimento,
        listarprocedimento,
        filtrarprocedimento,
        deletaprocedimento,
        publicarprocedimento,
        despublicarprocedimento,
        abreedtprocedimento,
        edtprocedimento,
        abreImportPopPdf,
        importPopPdf,
        abreaddmedicamento,
        addmedicamento,
        listarmedicamento,
        filtrarmedicamento,
        deletarmedicamento,
        publicarmedicamento,
        despublicarmedicamento,
        abreedtmedicamento,
        edtmedicamento,
        abreimportmedicamento,
        importmedicamento,
        abreRevisarImportMedicamento,
        confirmarImportMedicamento,
        abreaddterminologia,
        addterminologia,
        listarterminologia,
        filtrarterminologia,
        deletarterminologia,
        publicarterminologia,
        despublicarterminologia,
        abreedtterminologia,
        edtterminologia,
        abreaddquiz,
        addquiz,
        listarquiz,
        abreedtquiz,
        edtquiz,
        deletarquiz,
        publicarquiz,
        despublicarquiz
    } from '../controllers/admin.js';

function requireAdmin(req, res, next) {
    if (req.session?.usuario?.admin === true) {
        return next()
    }

    const nextUrl = encodeURIComponent(req.originalUrl || '/admin')
    return res.redirect(`/admin/login?next=${nextUrl}`)
}

//configuração de rotas que apontam para controllers que serão executados
router.get('/admin/login', abreloginadmin)
router.post('/admin/login', loginadmin)

router.use('/admin', requireAdmin)

router.get('/admin', abreadmin)
router.get("/admin/usuarios/lst", listarusuarios)
router.get("/admin/usuarios/detalhe/:id", detalhe)
router.get("/admin/usuarios/del/:id", deletarusuario)

//create do modelo categoria (create)
router.get('/admin/categoria/add', abreaddcategoria)
router.post('/admin/categoria/add', addcategoria)

//rotas do modelo categoria (read)
router.get('/admin/categoria/lst', listarcategoria)
router.post('/admin/categoria/lst', filtrarcategoria)

//rota do modelo categoria (delete)
router.get('/admin/categoria/del/:id', deletacategoria)

//rota do modelo categoria (editar)
router.get('/admin/categoria/edt/:id', abreedtcategoria)
router.post('/admin/categoria/edt/:id', edtcategoria)

//create do modelo procedimento (create)
router.get('/admin/procedimento/add', abreaddprocedimento)
router.post('/admin/procedimento/add', upload.array('fotos',5), addprocedimento)

//rotas do modelo procedimento (read)
router.get('/admin/procedimento/lst', listarprocedimento)
router.post('/admin/procedimento/lst', filtrarprocedimento)

//rota do modelo procedimento (delete)
router.get('/admin/procedimento/del/:id', deletaprocedimento)
router.get('/admin/procedimento/pub/:id', publicarprocedimento)
router.get('/admin/procedimento/unpub/:id', despublicarprocedimento)

//rota do modelo procedimento (editar)
router.get('/admin/procedimento/edt/:id', abreedtprocedimento)
router.post('/admin/procedimento/edt/:id', edtprocedimento)

// POPs em PDF (importação rápida)
router.get('/admin/procedimento/import-pop', abreImportPopPdf)
router.post('/admin/procedimento/import-pop', (req, res, next) => {
    popsPdfUpload.array('arquivos', 20)(req, res, (err) => {
        if (err) {
            return res.redirect('/admin/procedimento/import-pop?erro=Arquivo%20inv%C3%A1lido%20ou%20muito%20grande.')
        }
        return next()
    })
}, importPopPdf)

// -------- medicamento --------
router.get('/admin/medicamento/add', abreaddmedicamento)
router.post('/admin/medicamento/add', upload.array('fotos',5), addmedicamento)

router.get('/admin/medicamento/lst', listarmedicamento)
router.post('/admin/medicamento/lst', filtrarmedicamento)

router.get('/admin/medicamento/del/:id', deletarmedicamento)
router.get('/admin/medicamento/pub/:id', publicarmedicamento)
router.get('/admin/medicamento/unpub/:id', despublicarmedicamento)
router.get('/admin/medicamento/edt/:id', abreedtmedicamento)
router.post('/admin/medicamento/edt/:id', edtmedicamento)
router.get('/admin/medicamento/import', abreimportmedicamento)
router.post('/admin/medicamento/import', (req, res, next) => {
    pdfUpload.single('arquivo')(req, res, (err) => {
        if (err) {
            return res.redirect('/admin/medicamento/import?erro=Arquivo%20inv%C3%A1lido%20ou%20muito%20grande.')
        }
        return next()
    })
}, importmedicamento)
router.get('/admin/medicamento/import/revisar/:id', abreRevisarImportMedicamento)
router.post('/admin/medicamento/import/confirmar/:id', confirmarImportMedicamento)

// ---------- terminologia ----------
router.get('/admin/terminologia/add', abreaddterminologia)
router.post('/admin/terminologia/add', addterminologia)

router.get('/admin/terminologia/lst', listarterminologia)
router.post('/admin/terminologia/lst', filtrarterminologia)

router.get('/admin/terminologia/del/:id', deletarterminologia)
router.get('/admin/terminologia/pub/:id', publicarterminologia)
router.get('/admin/terminologia/unpub/:id', despublicarterminologia)
router.get('/admin/terminologia/edt/:id', abreedtterminologia)
router.post('/admin/terminologia/edt/:id', edtterminologia)

// ---------- quiz ----------
router.get('/admin/quiz/add', abreaddquiz)
router.post('/admin/quiz/add', addquiz)

router.get('/admin/quiz/lst', listarquiz)
router.get('/admin/quiz/edt/:id', abreedtquiz)
router.post('/admin/quiz/edt/:id', edtquiz)
router.get('/admin/quiz/del/:id', deletarquiz)
router.get('/admin/quiz/pub/:id', publicarquiz)
router.get('/admin/quiz/unpub/:id', despublicarquiz)


export default router
