export type AdminActionMenuPosition = { top: number; right: number; maxHeight: number };

export function adminActionMenuPosition(
  anchor: { top: number; right: number; bottom: number },
  menuHeight: number,
  viewport: { width: number; height: number },
): AdminActionMenuPosition {
  const availableBelow = Math.max(0, viewport.height - anchor.bottom - 8);
  const availableAbove = Math.max(0, anchor.top - 8);
  const opensAbove = availableBelow < menuHeight && availableAbove > availableBelow;
  const available = opensAbove ? availableAbove : availableBelow;
  const maxHeight = Math.max(100, Math.min(352, available));
  const visibleMenuHeight = Math.min(menuHeight, maxHeight);
  return {
    top: opensAbove
      ? Math.max(8, anchor.top - visibleMenuHeight - 6)
      : Math.max(8, Math.min(viewport.height - visibleMenuHeight - 8, anchor.bottom + 6)),
    right: Math.max(8, viewport.width - anchor.right),
    maxHeight,
  };
}
