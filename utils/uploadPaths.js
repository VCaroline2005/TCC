import fs from 'node:fs'
import path from 'node:path'

export const uploadPublicRoot = process.env.VERCEL
    ? path.join('/tmp', 'ifstore-public')
    : path.join(process.cwd(), 'public')

export function uploadPath(...parts) {
    return path.join(uploadPublicRoot, ...parts)
}

export function ensureUploadPath(...parts) {
    const dir = uploadPath(...parts)
    fs.mkdirSync(dir, { recursive: true })
    return dir
}
