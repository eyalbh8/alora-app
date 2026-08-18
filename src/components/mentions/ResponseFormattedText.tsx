import { parseResponseDisplaySections } from '../../lib/responseBody'

interface ResponseFormattedTextProps {
  text: string
}

export function ResponseFormattedText({ text }: ResponseFormattedTextProps) {
  const sections = parseResponseDisplaySections(text)

  return (
    <div className="space-y-4 text-sm leading-7 text-ink">
      {sections.map((section, index) => {
        if (section.type === 'paragraph') {
          return (
            <p key={index} className="whitespace-pre-wrap">
              {section.text}
            </p>
          )
        }
        return (
          <div key={index}>
            {section.label && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {section.label}
              </p>
            )}
            <ul className="list-disc space-y-2 pl-5 marker:text-muted-dark">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className="whitespace-pre-wrap">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
