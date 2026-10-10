// Вид: продукт каталога в том же формате, что и продукты на клиенте (значения на 100 г).
export function foodView(row) {
  const food = {
    id: "off" + row.code, src: "off", code: row.code, n: row.name,
    k: Number(row.k), p: Number(row.p), f: Number(row.f), cb: Number(row.cb), fb: Number(row.fb),
  };
  if (row.fb_est) food.fbEst = true;
  if (row.drink) { food.drink = true; food.hy = Number(row.hy); }
  if (row.sv != null) food.sv = Number(row.sv);
  return food;
}
