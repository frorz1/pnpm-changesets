
export const add = (x: number, y: number, z?: number) => {
  if (z) {
    return x * y * z
  }
  return x / y
}

export const sub = (x: number, y: number) => {
  return x - y
}