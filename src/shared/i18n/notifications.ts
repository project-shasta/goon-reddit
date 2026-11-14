import type { LanguageId } from '../types'

export interface NotificationTranslations {
  downloadFailedTitle: string
  downloadCompleteTitle: string
  downloadCompleteSummary: (done: number, skipped: number, failed: number) => string
  downloadCompleteNoMedia: string
  missingToolsBody: (tools: string[]) => string
}

export const notificationTranslations: Record<LanguageId, NotificationTranslations> = {
  en: {
    downloadFailedTitle: 'Download failed',
    downloadCompleteTitle: 'Download complete',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Downloaded ${done.toLocaleString()} file${done === 1 ? '' : 's'}`]
      if (skipped) parts.push(`skipped ${skipped.toLocaleString()}`)
      if (failed) parts.push(`${failed.toLocaleString()} failed`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'No downloadable media found',
    missingToolsBody: (tools) => `Missing ${tools.join(' and ')}. Check Settings → Tools.`
  },
  de: {
    downloadFailedTitle: 'Download fehlgeschlagen',
    downloadCompleteTitle: 'Download abgeschlossen',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Download abgeschlossen: ${done.toLocaleString()} Datei${done === 1 ? '' : 'en'}`]
      if (skipped) parts.push(`, ${skipped.toLocaleString()} übersprungen`)
      if (failed) parts.push(`, ${failed.toLocaleString()} fehlgeschlagen`)
      return `${parts.join('')}.`
    },
    downloadCompleteNoMedia: 'Keine herunterladbaren Medien gefunden',
    missingToolsBody: (tools) => `Fehlende Tools: ${tools.join(', ')}. Bitte laden Sie sie im Einstellungen → Tools herunter.`
  },
  fr: {
    downloadFailedTitle: 'Échec du téléchargement',
    downloadCompleteTitle: 'Téléchargement terminé',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Téléchargé : ${done.toLocaleString()} fichier${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} ignoré${skipped > 1 ? 's' : ''}`)
      if (failed) parts.push(`${failed.toLocaleString()} échoué${failed > 1 ? 's' : ''}`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'Aucun média téléchargeable trouvé',
    missingToolsBody: (tools) => `Outils manquants : ${tools.join(', ')}. Téléchargez-les dans Paramètres → Outils.`
  },
  it: {
    downloadFailedTitle: 'Download fallito',
    downloadCompleteTitle: 'Download completato',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Scaricati: ${done.toLocaleString()} file${done > 1 ? 'i' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} ignorati`)
      if (failed) parts.push(`${failed.toLocaleString()} falliti`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'Nessun media scaricabile trovato',
    missingToolsBody: (tools) => `Strumenti mancanti: ${tools.join(', ')}. Scaricali in Impostazioni → Strumenti.`
  },
  es: {
    downloadFailedTitle: 'Error al descargar',
    downloadCompleteTitle: 'Descarga completada',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Descargados: ${done.toLocaleString()} archivo${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} omitidos`)
      if (failed) parts.push(`${failed.toLocaleString()} fallidos`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'No se encontraron medios descargables',
    missingToolsBody: (tools) => `Herramientas faltantes: ${tools.join(', ')}. Descárgalas en Configuración → Herramientas.`
  },
  zh: {
    downloadFailedTitle: '下载失败',
    downloadCompleteTitle: '下载完成',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`已下载：${done.toLocaleString()} 个文件`]
      if (skipped) parts.push(`${skipped.toLocaleString()} 个已跳过`)
      if (failed) parts.push(`${failed.toLocaleString()} 个失败`)
      return `${parts.join('，')}.`
    },
    downloadCompleteNoMedia: '未找到可下载媒体',
    missingToolsBody: (tools) => `缺少工具：${tools.join('，')}。请在设置 → 工具中下载。`
  },
  'zh-TW': {
    downloadFailedTitle: '下載失敗',
    downloadCompleteTitle: '下載完成',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`已下載：${done.toLocaleString()} 個檔案`]
      if (skipped) parts.push(`${skipped.toLocaleString()} 個已跳過`)
      if (failed) parts.push(`${failed.toLocaleString()} 個失敗`)
      return `${parts.join('，')}.`
    },
    downloadCompleteNoMedia: '未找到可下載媒體',
    missingToolsBody: (tools) => `缺少工具：${tools.join('，')}。請在設定 → 工具中下載。`
  },
  ja: {
    downloadFailedTitle: 'ダウンロードに失敗しました',
    downloadCompleteTitle: 'ダウンロード完了',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`ダウンロード済み：${done.toLocaleString()}個のファイル`]
      if (skipped) parts.push(`${skipped.toLocaleString()}個をスキップ`)
      if (failed) parts.push(`${failed.toLocaleString()}個が失敗`)
      return `${parts.join('、')}.`
    },
    downloadCompleteNoMedia: 'ダウンロード可能なメディアが見つかりません',
    missingToolsBody: (tools) => `不足ツール：${tools.join('、')}。設定→ツールからダウンロードしてください。`
  },
  uk: {
    downloadFailedTitle: 'Помилка завантаження',
    downloadCompleteTitle: 'Завантаження завершено',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Завантажено: ${done.toLocaleString()} файл${done > 1 ? 'и' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} пропущено`)
      if (failed) parts.push(`${failed.toLocaleString()} невдало`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'Не знайдено завантажуваних медіа',
    missingToolsBody: (tools) => `Відсутні інструменти: ${tools.join(', ')}. Завантажте їх у Налаштування → Інструменти.`
  },
  pirate: {
    downloadFailedTitle: 'Ahoy, the download failed!',
    downloadCompleteTitle: 'Treasure secured!',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Ye got ${done.toLocaleString()} file${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} left beached`)
      if (failed) parts.push(`${failed.toLocaleString()} went down with the ship`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'No booty found in these waters.',
    missingToolsBody: (tools) => `Missing yer tools: ${tools.join(', ')}. Fetch 'em from Settings → Tools, matey!`
  },
  cyberpunk: {
    downloadFailedTitle: 'Download failure detected',
    downloadCompleteTitle: 'Download complete',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Downloaded: ${done.toLocaleString()} file${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} skipped`)
      if (failed) parts.push(`${failed.toLocaleString()} failed`)
      return `${parts.join(', ')}. System status: ${failed > 0 ? 'CRITICAL' : 'OK'}.`
    },
    downloadCompleteNoMedia: 'No media found in data stream.',
    missingToolsBody: (tools) => `Missing tools: ${tools.join(', ')}. Install from Settings → Tools. Stay sharp, netrunner.`
  },
  eo: {
    downloadFailedTitle: 'Elŝutado malsukcesis',
    downloadCompleteTitle: 'Elŝutado finita',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Elŝutita: ${done.toLocaleString()} dosier${done > 1 ? 'oj' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} preterlasit${skipped > 1 ? 'oj' : 'o'}`)
      if (failed) parts.push(`${failed.toLocaleString()} malsukces${failed > 1 ? 'is' : 'is'}`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'Neniu elŝutebla mezo trovita',
    missingToolsBody: (tools) => `Mankantaj iloj: ${tools.join(', ')}. Elŝutu ilin el Agordoj → Iloj.`
  },
  enSimple: {
    downloadFailedTitle: 'Download failed',
    downloadCompleteTitle: 'Download done',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Downloaded ${done.toLocaleString()} file${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} skipped`)
      if (failed) parts.push(`${failed.toLocaleString()} failed`)
      return `${parts.join(', ')}.`
    },
    downloadCompleteNoMedia: 'No media found to download.',
    missingToolsBody: (tools) => `Missing tools: ${tools.join(', ')}. Get them from Settings → Tools.`
  },
  matrix: {
    downloadFailedTitle: 'Download failed',
    downloadCompleteTitle: 'Download complete',
    downloadCompleteSummary: (done, skipped, failed) => {
      const parts: string[] = [`Downloaded: ${done.toLocaleString()} file${done > 1 ? 's' : ''}`]
      if (skipped) parts.push(`${skipped.toLocaleString()} skipped`)
      if (failed) parts.push(`${failed.toLocaleString()} failed`)
      return `${parts.join(', ')}. Matrix status: ${failed > 0 ? 'ERROR' : 'OK'}.`
    },
    downloadCompleteNoMedia: 'No media found in the Matrix.',
    missingToolsBody: (tools) => `Missing tools: ${tools.join(', ')}. Install from Settings → Tools.`
  }
}

export function translateNotification(
  title: string,
  body: string,
  language: LanguageId
): { title: string; body: string } {
  const t = notificationTranslations[language] ?? notificationTranslations.en

  if (title === 'Download failed') {
    return { title: t.downloadFailedTitle, body }
  }

  if (title === 'Download complete') {
    if (body === 'No downloadable media found.') {
      return { title: t.downloadCompleteTitle, body: t.downloadCompleteNoMedia }
    }
    const match = body.match(/^Downloaded (\d+) file(?:s)?(?:, skipped (\d+))?(?:, (\d+) failed)?\.$/)
    if (match) {
      const done = parseInt(match[1])
      const skipped = match[2] ? parseInt(match[2]) : 0
      const failed = match[3] ? parseInt(match[3]) : 0
      return { title: t.downloadCompleteTitle, body: t.downloadCompleteSummary(done, skipped, failed) }
    }
  }

  return { title, body }
}
