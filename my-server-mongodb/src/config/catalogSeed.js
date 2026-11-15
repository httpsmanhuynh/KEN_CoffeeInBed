'use strict';

const { ObjectId } = require('mongodb');

const ZONE_SEEDS = [
  {
    zone_code: 'KEN_TAP_TRUNG',
    name: 'KÉN Tập Trung',
    description: 'Không gian làm việc, học tập và họp nhóm.',
    is_bookable: true,
    is_active: true,
    image_url: '/images/ken-flow/listing-work.png',
  },
  {
    zone_code: 'KEN_TAI_TAO',
    name: 'KÉN Tái Tạo',
    description: 'Không gian nghỉ ngơi và thư giãn.',
    is_bookable: true,
    is_active: true,
    image_url: '/images/ken-flow/listing-single.png',
  },
];

const SPACE_SEEDS = [
  {
    space_code: 'FP-01',
    zone_code: 'KEN_TAP_TRUNG',
    name: 'Ô tập trung cá nhân (Focus Pod)',
    space_type: 'FOCUS_POD',
    booking_mode: 'EXCLUSIVE',
    capacity: 1,
    min_guests: 1,
    max_guests: 1,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-focus.png',
    amenities: ['Wi-Fi', 'Ổ cắm điện'],
  },
  {
    space_code: 'WL-01',
    zone_code: 'KEN_TAP_TRUNG',
    name: 'Khu làm việc chung (Work Lounge)',
    space_type: 'WORK_LOUNGE',
    booking_mode: 'SHARED',
    capacity: 20,
    min_guests: 1,
    max_guests: 20,
    buffer_minutes: 0,
    image_url: '/images/ken-flow/listing-work.png',
    amenities: ['Wi-Fi', 'Ổ cắm điện'],
  },
  {
    space_code: 'SMR-01',
    zone_code: 'KEN_TAP_TRUNG',
    name: 'Phòng họp nhỏ (Small Meeting Room)',
    space_type: 'MEETING_ROOM',
    booking_mode: 'EXCLUSIVE',
    capacity: 6,
    min_guests: 3,
    max_guests: 6,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-meeting-small.png',
    amenities: ['Wi-Fi', 'Ổ cắm điện', 'Máy chiếu', 'Bảng viết'],
  },
  {
    space_code: 'BR-01',
    zone_code: 'KEN_TAP_TRUNG',
    name: 'Phòng họp lớn (Boardroom)',
    space_type: 'MEETING_ROOM',
    booking_mode: 'EXCLUSIVE',
    capacity: 12,
    min_guests: 6,
    max_guests: 12,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-meeting-small.png',
    amenities: ['Wi-Fi', 'Ổ cắm điện', 'Máy chiếu', 'Bảng viết'],
  },
  {
    space_code: 'SBP-01',
    zone_code: 'KEN_TAI_TAO',
    name: 'KÉN nghỉ đơn (Single Bed Pod)',
    space_type: 'SLEEPING_POD',
    booking_mode: 'EXCLUSIVE',
    capacity: 1,
    min_guests: 1,
    max_guests: 1,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-single.png',
    amenities: ['Wi-Fi', 'Rèm che', 'Đèn đọc sách'],
  },
  {
    space_code: 'DBP-01',
    zone_code: 'KEN_TAI_TAO',
    name: 'KÉN nghỉ đôi (Double Bed Pod)',
    space_type: 'SLEEPING_POD',
    booking_mode: 'EXCLUSIVE',
    capacity: 2,
    min_guests: 1,
    max_guests: 2,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-single.png',
    amenities: ['Wi-Fi', 'Rèm che', 'Đèn đọc sách'],
  },
  {
    space_code: 'PS-01',
    zone_code: 'KEN_TAI_TAO',
    name: 'Phòng riêng tư (Private Studio)',
    space_type: 'PRIVATE_ROOM',
    booking_mode: 'EXCLUSIVE',
    capacity: 4,
    min_guests: 2,
    max_guests: 4,
    buffer_minutes: 15,
    image_url: '/images/ken-flow/listing-private.png',
    amenities: ['Wi-Fi', 'Bàn ghế', 'Rèm che'],
  },
];

const PACKAGE_SEEDS = [
  { package_code: 'PKG_FP_HOURLY', zone_code: 'KEN_TAP_TRUNG', name: 'Focus Pod theo giờ', package_type: 'HOURLY', pricing_unit: 'PER_SPACE', duration_hours: null, min_hours: 1, description: 'Đặt Focus Pod theo số giờ sử dụng.' },
  { package_code: 'PKG_FP_HALF', zone_code: 'KEN_TAP_TRUNG', name: 'Focus Pod nửa ngày · 4 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 4, min_hours: 1, description: 'Gói Focus Pod cố định 4 giờ.' },
  { package_code: 'PKG_WL_HOURLY', zone_code: 'KEN_TAP_TRUNG', name: 'Work Lounge theo giờ', package_type: 'HOURLY', pricing_unit: 'PER_PERSON', duration_hours: null, min_hours: 1, description: 'Đặt Work Lounge theo người và số giờ.' },
  { package_code: 'PKG_WL_HALF', zone_code: 'KEN_TAP_TRUNG', name: 'Work Lounge nửa ngày · 4 giờ', package_type: 'FIXED', pricing_unit: 'PER_PERSON', duration_hours: 4, min_hours: 1, description: 'Gói Work Lounge cố định 4 giờ, tính theo người.' },
  { package_code: 'PKG_WL_FULL', zone_code: 'KEN_TAP_TRUNG', name: 'Work Lounge cả ngày', package_type: 'FIXED', pricing_unit: 'PER_PERSON', duration_hours: 14, is_full_day: true, min_hours: 1, description: 'Gói Work Lounge trong giờ hoạt động 08:00–22:00, tính theo người.' },
  { package_code: 'PKG_SMR_3H', zone_code: 'KEN_TAP_TRUNG', name: 'Phòng họp nhỏ · 3 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 3, min_hours: 1, description: 'Đặt trọn phòng họp nhỏ trong 3 giờ.' },
  { package_code: 'PKG_BR_3H', zone_code: 'KEN_TAP_TRUNG', name: 'Phòng họp lớn · 3 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 3, min_hours: 1, description: 'Đặt trọn phòng họp lớn trong 3 giờ.' },
  { package_code: 'PKG_REST_SINGLE', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đơn theo giờ', package_type: 'HOURLY', pricing_unit: 'PER_SPACE', duration_hours: null, min_hours: 1, description: 'Đặt KÉN nghỉ đơn theo số giờ.' },
  { package_code: 'PKG_REST_DOUBLE', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đôi theo giờ', package_type: 'HOURLY', pricing_unit: 'PER_SPACE', duration_hours: null, min_hours: 1, description: 'Đặt KÉN nghỉ đôi theo số giờ.' },
  { package_code: 'PKG_REST_PRIVATE', zone_code: 'KEN_TAI_TAO', name: 'Phòng riêng tư theo giờ', package_type: 'HOURLY', pricing_unit: 'PER_SPACE', duration_hours: null, min_hours: 1, description: 'Đặt phòng riêng tư theo số giờ.' },
  { package_code: 'PKG_SINGLE_1H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đơn · 1 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 1, min_hours: 1, description: 'Gói KÉN nghỉ đơn cố định 1 giờ.' },
  { package_code: 'PKG_SINGLE_2H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đơn · 2 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 2, min_hours: 1, description: 'Gói KÉN nghỉ đơn cố định 2 giờ.' },
  { package_code: 'PKG_SINGLE_4H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đơn · 4 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 4, min_hours: 1, description: 'Gói KÉN nghỉ đơn cố định 4 giờ.' },
  { package_code: 'PKG_DOUBLE_1H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đôi · 1 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 1, min_hours: 1, description: 'Gói KÉN nghỉ đôi cố định 1 giờ.' },
  { package_code: 'PKG_DOUBLE_2H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đôi · 2 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 2, min_hours: 1, description: 'Gói KÉN nghỉ đôi cố định 2 giờ.' },
  { package_code: 'PKG_DOUBLE_4H', zone_code: 'KEN_TAI_TAO', name: 'KÉN nghỉ đôi · 4 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 4, min_hours: 1, description: 'Gói KÉN nghỉ đôi cố định 4 giờ.' },
  { package_code: 'PKG_PRIVATE_1H', zone_code: 'KEN_TAI_TAO', name: 'Phòng riêng tư · 1 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 1, min_hours: 1, description: 'Gói phòng riêng tư cố định 1 giờ.' },
  { package_code: 'PKG_PRIVATE_2H', zone_code: 'KEN_TAI_TAO', name: 'Phòng riêng tư · 2 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 2, min_hours: 1, description: 'Gói phòng riêng tư cố định 2 giờ.' },
  { package_code: 'PKG_PRIVATE_4H', zone_code: 'KEN_TAI_TAO', name: 'Phòng riêng tư · 4 giờ', package_type: 'FIXED', pricing_unit: 'PER_SPACE', duration_hours: 4, min_hours: 1, description: 'Gói phòng riêng tư cố định 4 giờ.' },
];

const PRICE_SEEDS = [
  { space_code: 'FP-01', package_code: 'PKG_FP_HOURLY', price: 45000 },
  { space_code: 'FP-01', package_code: 'PKG_FP_HALF', price: 140000 },
  { space_code: 'WL-01', package_code: 'PKG_WL_HOURLY', price: 30000 },
  { space_code: 'WL-01', package_code: 'PKG_WL_HALF', price: 90000 },
  { space_code: 'WL-01', package_code: 'PKG_WL_FULL', price: 150000 },
  { space_code: 'SMR-01', package_code: 'PKG_SMR_3H', price: 250000 },
  { space_code: 'BR-01', package_code: 'PKG_BR_3H', price: 450000 },
  { space_code: 'SBP-01', package_code: 'PKG_REST_SINGLE', price: 70000 },
  { space_code: 'DBP-01', package_code: 'PKG_REST_DOUBLE', price: 100000 },
  { space_code: 'PS-01', package_code: 'PKG_REST_PRIVATE', price: 150000 },
  { space_code: 'SBP-01', package_code: 'PKG_SINGLE_1H', price: 70000 },
  { space_code: 'SBP-01', package_code: 'PKG_SINGLE_2H', price: 130000 },
  { space_code: 'SBP-01', package_code: 'PKG_SINGLE_4H', price: 220000 },
  { space_code: 'DBP-01', package_code: 'PKG_DOUBLE_1H', price: 100000 },
  { space_code: 'DBP-01', package_code: 'PKG_DOUBLE_2H', price: 180000 },
  { space_code: 'DBP-01', package_code: 'PKG_DOUBLE_4H', price: 310000 },
  { space_code: 'PS-01', package_code: 'PKG_PRIVATE_1H', price: 150000 },
  { space_code: 'PS-01', package_code: 'PKG_PRIVATE_2H', price: 280000 },
  { space_code: 'PS-01', package_code: 'PKG_PRIVATE_4H', price: 480000 },
];

const PACKAGE_BY_SPACE = {
  'FP-01': ['PKG_FP_HOURLY', 'PKG_FP_HALF'],
  'WL-01': ['PKG_WL_HOURLY', 'PKG_WL_HALF', 'PKG_WL_FULL'],
  'SMR-01': ['PKG_SMR_3H'],
  'BR-01': ['PKG_BR_3H'],
  'SBP-01': ['PKG_REST_SINGLE', 'PKG_SINGLE_1H', 'PKG_SINGLE_2H', 'PKG_SINGLE_4H'],
  'DBP-01': ['PKG_REST_DOUBLE', 'PKG_DOUBLE_1H', 'PKG_DOUBLE_2H', 'PKG_DOUBLE_4H'],
  'PS-01': ['PKG_REST_PRIVATE', 'PKG_PRIVATE_1H', 'PKG_PRIVATE_2H', 'PKG_PRIVATE_4H'],
};

async function seedCatalog(db, now = new Date()) {
  const zones = db.collection('zones');
  for (const zone of ZONE_SEEDS) {
    await zones.updateOne(
      { zone_code: zone.zone_code },
      { $setOnInsert: { _id: new ObjectId(), ...zone, created_at: now, updated_at: now } },
      { upsert: true },
    );
  }
  const zoneDocs = await zones.find({ zone_code: { $in: ZONE_SEEDS.map((zone) => zone.zone_code) } }).toArray();
  const zoneByCode = new Map(zoneDocs.map((zone) => [zone.zone_code, zone]));

  const spaces = db.collection('spaces');
  for (const seed of SPACE_SEEDS) {
    const { zone_code, ...space } = seed;
    const zone = zoneByCode.get(zone_code);
    if (!zone) throw new Error(`Missing seeded zone ${zone_code}`);
    await spaces.updateOne(
      { space_code: space.space_code },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          zone_id: zone._id,
          ...space,
          open_time: '08:00',
          close_time: '22:00',
          status: 'ACTIVE',
          lock_version: 0,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true },
    );
  }
  const spaceDocs = await spaces.find({ space_code: { $in: SPACE_SEEDS.map((space) => space.space_code) } }).toArray();
  const spaceByCode = new Map(spaceDocs.map((space) => [space.space_code, space]));

  const packages = db.collection('packages');
  for (const seed of PACKAGE_SEEDS) {
    const { zone_code, ...pkg } = seed;
    const zone = zoneByCode.get(zone_code);
    if (!zone) throw new Error(`Missing seeded zone ${zone_code}`);
    await packages.updateOne(
      { package_code: pkg.package_code },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          zone_id: zone._id,
          is_full_day: false,
          is_active: true,
          ...pkg,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true },
    );
  }
  const packageDocs = await packages
    .find({ package_code: { $in: PACKAGE_SEEDS.map((pkg) => pkg.package_code) } })
    .toArray();
  const packageByCode = new Map(packageDocs.map((pkg) => [pkg.package_code, pkg]));

  const prices = db.collection('package_prices');
  for (const seed of PRICE_SEEDS) {
    const space = spaceByCode.get(seed.space_code);
    const pkg = packageByCode.get(seed.package_code);
    if (!space || !pkg) throw new Error(`Missing seeded space/package for ${seed.space_code}`);
    await prices.updateOne(
      { space_id: space._id, package_id: pkg._id },
      { $setOnInsert: { _id: new ObjectId(), space_id: space._id, package_id: pkg._id, price: seed.price } },
      { upsert: true },
    );
  }

  const inclusions = db.collection('package_inclusions');
  for (const [spaceCode, packageCodes] of Object.entries(PACKAGE_BY_SPACE)) {
    for (const packageCode of packageCodes) {
      const pkg = packageByCode.get(packageCode);
      if (!pkg) throw new Error(`Missing seeded package ${packageCode}`);
      if (spaceCode === 'WL-01' || ['SBP-01', 'DBP-01', 'PS-01'].includes(spaceCode)) {
        await inclusions.updateOne(
          { package_id: pkg._id, item_type: 'WATER' },
          {
            $setOnInsert: {
              _id: new ObjectId(),
              package_id: pkg._id,
              item_type: 'WATER',
              product_id: null,
              label: 'Nước suối',
              quantity: 1,
              quantity_basis: 'PER_GUEST',
              subsidy_limit: null,
              min_hours_required: 2,
              is_active: true,
            },
          },
          { upsert: true },
        );
      }
    }
  }

  return {
    zones: ZONE_SEEDS.length,
    spaces: SPACE_SEEDS.length,
    packages: PACKAGE_SEEDS.length,
    prices: PRICE_SEEDS.length,
  };
}

async function run() {
  require('dotenv').config();
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    const summary = await seedCatalog(client.db('ken_space_booking'));
    console.log(`Catalog seed ready: ${summary.zones} zones, ${summary.spaces} spaces, ${summary.packages} packages, ${summary.prices} prices.`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Catalog seed failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { seedCatalog };
