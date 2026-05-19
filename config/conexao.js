import 'dotenv/config'
import mongoose from 'mongoose'

const url =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  'mongodb://127.0.0.1:27017/ifstore'

// `mongoose.connect()` retorna uma Promise; exporte o `mongoose` para usar
// `Schema` e `model` nos arquivos de models.
const connectPromise = mongoose.connect(url, {
  serverSelectionTimeoutMS: 10000,
})

connectPromise
  .then(() => {
    console.log('MongoDB conectado:', `${mongoose.connection.host}/${mongoose.connection.name}`)
  })
  .catch(() => {
    // erro tratado no catch abaixo
  })

connectPromise.catch((err) => {
  const message = err?.message || String(err)
  const code = err?.code
  const syscall = err?.syscall
  const name = err?.name
  const cause = err?.cause
  const reason = err?.reason

  const details = {
    name,
    code,
    syscall,
    message,
    cause: cause?.message || cause,
    reason: reason?.message || reason,
  }

  if (code === 'ECONNREFUSED' && typeof syscall === 'string' && syscall.startsWith('query')) {
    console.error(
      'Erro ao conectar no MongoDB: falha de DNS (não foi possível resolver o host). ' +
        'Verifique internet/DNS/firewall do ambiente onde o Node está rodando.',
      details
    )
    return
  }

  if (
    typeof message === 'string' &&
    code === 'ECONNREFUSED' &&
    (url.includes('127.0.0.1') || url.includes('localhost'))
  ) {
    console.error(
      'Erro ao conectar no MongoDB: o MongoDB local parece não estar rodando. ' +
        'Inicie o serviço (mongod) ou suba via Docker e confirme a URI em MONGODB_URI.',
      details
    )
    return
  }

  if (typeof message === 'string' && message.includes("isn't whitelisted")) {
    console.error(
      'Erro ao conectar no MongoDB: seu IP público provavelmente não está liberado no Atlas (Network Access / IP Access List).',
      details
    )
    return
  }

  console.error('Erro ao conectar no MongoDB:', details)
})

export { connectPromise }
export default mongoose
