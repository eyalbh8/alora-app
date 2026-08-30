interface MenchlyLogoProps {
  className?: string
  title?: string
}

/** Inline mark so layout never flashes at the SVG's native 435×359 size. */
export function MenchlyLogo({ className, title }: MenchlyLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 435 359"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <g fill="#111111">
        <path d="M 302 55 L 288 63 L 277 74 L 270 83 L 269 86 L 262 96 L 248 126 L 243 141 L 243 144 L 240 151 L 238 162 L 236 166 L 234 178 L 232 182 L 230 196 L 229 197 L 230 198 L 232 195 L 238 191 L 258 173 L 264 169 L 288 148 L 292 146 L 293 147 L 293 321 L 294 322 L 399 322 L 399 321 L 392 319 L 377 310 L 368 301 L 363 290 L 363 91 L 368 80 L 376 72 L 398 58 L 403 56 L 405 54 L 409 53 L 408 52 L 314 52 L 313 53 L 309 53 L 305 55 Z" />
        <path d="M 27 52 L 26 53 L 39 59 L 60 72 L 71 83 L 75 92 L 75 286 L 71 298 L 60 310 L 42 320 L 37 321 L 37 322 L 142 322 L 143 321 L 143 146 L 145 145 L 183 178 L 207 197 L 199 161 L 185 119 L 176 100 L 174 98 L 173 94 L 160 75 L 146 61 L 135 55 L 128 53 L 124 53 L 123 52 Z" />
      </g>
      <g fill="#0649DB">
        <path d="M 201 102 L 200 103 L 203 110 L 203 113 L 206 122 L 206 127 L 209 137 L 210 149 L 212 154 L 214 173 L 215 174 L 215 179 L 217 186 L 217 192 L 218 193 L 218 197 L 219 197 L 218 191 L 219 190 L 220 191 L 220 194 L 221 180 L 223 173 L 223 167 L 225 160 L 226 148 L 228 143 L 229 132 L 230 131 L 233 112 L 236 102 Z" />
      </g>
    </svg>
  )
}
