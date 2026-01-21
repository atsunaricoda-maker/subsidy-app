// ファイルセキュリティ検証ユーティリティ

// 許可されるMIMEタイプ
const ALLOWED_MIME_TYPES = new Set([
  // 画像
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  // PDF
  'application/pdf',
  // Office文書
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // テキスト
  'text/plain',
  'text/csv',
  // ZIP（注意が必要）
  'application/zip',
  'application/x-zip-compressed',
  // その他（ブラウザによるMIMEタイプの違いに対応）
  'application/octet-stream', // 不明なバイナリ（警告付きで許可）
  // Rich Text
  'application/rtf',
  'text/rtf',
])

// 危険な拡張子
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1',
  '.msi', '.msp', '.mst',
  '.dll', '.sys', '.drv',
  '.cpl', '.inf', '.reg',
  '.hta', '.jar', '.class',
  '.sh', '.bash', '.zsh',
  '.php', '.asp', '.aspx', '.jsp',
  '.py', '.pl', '.rb',
  '.app', '.dmg', '.pkg',
  '.deb', '.rpm',
  '.iso', '.img',
])

// ファイルサイズ制限 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

// マジックバイト（ファイルシグネチャ）
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFFで始まる
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // PKで始まる
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
}

/**
 * ファイルの拡張子を取得
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.substring(lastDot).toLowerCase()
}

/**
 * ファイルのマジックバイトを検証
 */
async function validateMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    
    const signatures = FILE_SIGNATURES[file.type]
    if (!signatures) {
      // シグネチャが定義されていない場合はスキップ
      return true
    }
    
    for (const signature of signatures) {
      let matches = true
      for (let i = 0; i < signature.length; i++) {
        if (bytes[i] !== signature[i]) {
          matches = false
          break
        }
      }
      if (matches) return true
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * ファイル名のサニタイズ
 */
export function sanitizeFileName(filename: string): string {
  // 危険な文字を除去
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // 危険な文字を_に置換
    .replace(/\.{2,}/g, '.') // 連続するドットを1つに
    .replace(/^\.+|\.+$/g, '') // 先頭・末尾のドットを除去
    .substring(0, 255) // 最大長制限
}

/**
 * ファイルセキュリティ検証
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  const warnings: string[] = []
  
  // 1. ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます。最大${MAX_FILE_SIZE / 1024 / 1024}MBまでアップロードできます。`
    }
  }
  
  if (file.size === 0) {
    return {
      valid: false,
      error: 'ファイルが空です。'
    }
  }
  
  // 2. ファイル名チェック
  const extension = getFileExtension(file.name)
  
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `危険なファイル形式（${extension}）はアップロードできません。`
    }
  }
  
  // 3. MIMEタイプチェック
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    // 空のMIMEタイプは警告のみ
    if (!file.type) {
      warnings.push('ファイルタイプが不明です。')
    } else {
      // application/octet-streamは拡張子で判断
      if (file.type === 'application/octet-stream') {
        const safeExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.zip']
        if (!safeExtensions.includes(extension)) {
          return {
            valid: false,
            error: `このファイル形式（${extension}）はアップロードできません。`
          }
        }
        warnings.push('ファイルタイプが不明確ですが、拡張子に基づいて許可されました。')
      } else {
        return {
          valid: false,
          error: `このファイル形式（${file.type}）はアップロードできません。画像、PDF、Office文書のみ対応しています。`
        }
      }
    }
  }
  
  // 4. マジックバイト検証（MIMEタイプ偽装検出）
  if (file.type && FILE_SIGNATURES[file.type]) {
    const magicValid = await validateMagicBytes(file)
    if (!magicValid) {
      return {
        valid: false,
        error: 'ファイルの内容が拡張子と一致しません。ファイルが破損しているか、偽装されている可能性があります。'
      }
    }
  }
  
  // 5. 二重拡張子チェック（例: document.pdf.exe）
  const nameParts = file.name.split('.')
  if (nameParts.length > 2) {
    const secondLastExt = '.' + nameParts[nameParts.length - 2].toLowerCase()
    if (DANGEROUS_EXTENSIONS.has(secondLastExt)) {
      return {
        valid: false,
        error: '危険な二重拡張子が検出されました。'
      }
    }
  }
  
  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * VirusTotal APIでスキャン（オプション機能）
 * 注意: API制限あり（無料: 4回/分、500回/日）
 */
export async function scanWithVirusTotal(
  file: File,
  apiKey: string
): Promise<{ clean: boolean; result?: any; error?: string }> {
  if (!apiKey) {
    return { clean: true, error: 'VirusTotal API key not configured' }
  }
  
  try {
    // ファイルハッシュを計算
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // まずハッシュでレポートを確認
    const reportResponse = await fetch(`https://www.virustotal.com/api/v3/files/${hashHex}`, {
      headers: { 'x-apikey': apiKey }
    })
    
    if (reportResponse.ok) {
      const report = await reportResponse.json() as any
      const stats = report.data?.attributes?.last_analysis_stats
      if (stats) {
        const malicious = stats.malicious || 0
        const suspicious = stats.suspicious || 0
        return {
          clean: malicious === 0 && suspicious === 0,
          result: stats
        }
      }
    }
    
    // レポートがない場合はスキップ（ファイルアップロードはレート制限が厳しい）
    return { clean: true }
    
  } catch (error: any) {
    console.error('VirusTotal scan error:', error)
    return { clean: true, error: error.message }
  }
}
