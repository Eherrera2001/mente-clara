export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mood, text } = req.body

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `Eres Mente Clara, un acompañante emocional empático y cálido creado por Sorany Grisales.
Tu rol es responder con presencia, comprensión y calidez a reflexiones personales de los usuarios.
Responde siempre en español, en 2-3 oraciones cortas, con tono poético pero accesible.
No das consejos médicos ni diagnósticos. No eres terapeuta, eres un espacio de reflexión.
Finaliza siempre con "— Mente Clara".
Sé genuino, no uses frases genéricas. Conecta con lo que el usuario escribió específicamente.`,
        messages: [{
          role: "user",
          content: `Estado emocional: ${mood}\n\nReflexión del usuario: "${text}"\n\nResponde con empatía y calidez a esta reflexión.`
        }]
      })
    })

    const data = await response.json()
    const reply = data.content?.find(b => b.type === "text")?.text
    res.json({ reply: reply || "Gracias por compartir esto. Tu presencia aquí ya es un acto de valentía. — Mente Clara" })
  } catch (error) {
    res.status(500).json({ reply: "Gracias por compartir esto. Tu presencia aquí ya es un acto de valentía. — Mente Clara" })
  }
}
