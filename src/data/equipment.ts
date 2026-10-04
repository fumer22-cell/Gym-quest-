import type { EquipmentId } from '../types';

export const EQUIPMENT: { id: EquipmentId; label: string }[] = [
  { id: 'barbell', label: 'Barbell & plates' },
  { id: 'squat_rack', label: 'Squat rack' },
  { id: 'bench', label: 'Flat / incline bench' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'ez_bar', label: 'EZ curl bar' },
  { id: 'cable', label: 'Cable station' },
  { id: 'lat_pulldown', label: 'Lat pulldown / row machine' },
  { id: 'leg_press', label: 'Leg press' },
  { id: 'leg_curl', label: 'Leg curl machine' },
  { id: 'leg_extension', label: 'Leg extension machine' },
  { id: 'chest_press_machine', label: 'Chest press machine' },
  { id: 'shoulder_press_machine', label: 'Shoulder press machine' },
  { id: 'pullup_bar', label: 'Pull-up bar' },
  { id: 'dip_station', label: 'Dip station' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'ab_wheel', label: 'Ab wheel' },
];

export const ALL_EQUIPMENT: EquipmentId[] = EQUIPMENT.map((e) => e.id);
