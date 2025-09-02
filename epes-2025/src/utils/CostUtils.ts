export function sumCosts(
  selected: string[],
  options: { label: string; cost: number }[]
): number {
  return selected.reduce((acc, label) => {
    const item = options.find(opt => opt.label === label);
    return acc + (item?.cost || 0);
  }, 0);
}
