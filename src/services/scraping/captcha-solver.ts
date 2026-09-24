export type CaptchaProvider = 'ANTICAPTCHA' | 'CAPTCHA_AI' | 'MANUAL'

export interface CaptchaSolverConfig {
  provider: CaptchaProvider
  apiKey?: string
}

export async function solveCaptcha(
  imageBase64: string,
  config: CaptchaSolverConfig,
): Promise<string> {
  switch (config.provider) {
    case 'ANTICAPTCHA':
      return solveAntiCaptcha(imageBase64, config.apiKey)
    case 'CAPTCHA_AI':
      return solveCaptchaAI(imageBase64, config.apiKey)
    case 'MANUAL':
      throw new Error('Captcha manual no implementado. Use el proveedor ANTICAPTCHA o CAPTCHA_AI.')
    default:
      throw new Error(`Proveedor de captcha no soportado: ${config.provider}`)
  }
}

async function solveAntiCaptcha(imageBase64: string, apiKey?: string): Promise<string> {
  if (!apiKey) throw new Error('ANTICAPTCHA_KEY no configurada')

  const createTaskResponse = await fetch('https://api.anti-captcha.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: 'ImageToTextTask',
        body: imageBase64,
        phrase: false,
        case: true,
        numeric: 0,
        math: false,
        minLength: 0,
        maxLength: 0,
      },
    }),
  })

  const createTask = await createTaskResponse.json()
  if (createTask.errorId) {
    throw new Error(`AntiCaptcha error: ${createTask.errorCode} - ${createTask.errorDescription}`)
  }

  const taskId = createTask.taskId

  for (let i = 0; i < 60; i++) {
    await sleep(3000)
    const resultResponse = await fetch('https://api.anti-captcha.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    })
    const result = await resultResponse.json()
    if (result.status === 'ready') return result.solution.text
  }

  throw new Error('AntiCaptcha: tiempo de espera agotado')
}

async function solveCaptchaAI(imageBase64: string, apiKey?: string): Promise<string> {
  if (!apiKey) throw new Error('CAPTCHA_AI_API_KEY no configurada')

  const response = await fetch('https://api.captcha-ai.com/solve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image: imageBase64,
      type: 'text',
    }),
  })

  const data = await response.json()
  if (!data.solved) throw new Error(`Captcha AI error: ${data.error ?? 'unknown'}`)
  return data.text
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
