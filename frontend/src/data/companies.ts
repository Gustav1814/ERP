export type AddressKind = 'billing' | 'pickup' | 'shipping' | 'other';

export type CompanyAddress = {
  id: number;
  company_id: number;
  kind: AddressKind;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type CompanyUser = {
  id: number;
  company_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_primary?: boolean;
};

export type ErpOrder = {
  id: number;
  company_id: number;
  billing_address_id: number | null;
  pickup_address_id: number | null;
  source_system: string;
  source_lead_id: number;
  source_order_id: string;
  title: string;
  services: string[];
  type_of_equipment: string;
  quantity: string;
  estimate_value: number;
  pickup_cost: number;
  pickup_cost_status: 'pending' | 'approved' | 'rejected';
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  qualify_status: 'qualified' | 'unqualified' | 'pending';
  data_destruction_type?: string;
  message?: string;
  start_date: string;
  pickup_date: string;
  attachments: string[];
  created_at: string;
  detail_rows: OrderDetailRow[];
};

export type OrderDetailRow = {
  order_seq: string;
  pk_status: string;
  asin: string;
  location: string;
  make_model: string;
  model_type: string;
  serial_number: string;
  condition: string;
  next_steps: string;
  market: string;
  order_id?: string;
  price?: number;
  fees?: number;
  profit?: number;
  notes?: string;
};

export type Company = {
  id: number;
  name: string;
  primary_contact_name: string;
  primary_contact_user_id?: number | null;
  project_manager: string;
  primary_email: string;
  primary_phone: string;
  customer_type: 'commercial' | 'residential' | 'government';
  lead_channel: 'web' | 'referral' | 'outbound' | 'event';
  hear_about_us: string;
  created_at: string;
  addresses: CompanyAddress[];
  users?: CompanyUser[];
  orders: ErpOrder[];
};

export const companies: Company[] = [
  {
    id: 101,
    name: 'Orbit Freight Pvt Ltd',
    primary_contact_name: 'Ayesha Khan',
    project_manager: 'Hassan Raza',
    primary_email: 'ayesha@orbitfreight.com',
    primary_phone: '+92 300 1234567',
    customer_type: 'commercial',
    lead_channel: 'web',
    hear_about_us: 'Google Search',
    created_at: '2026-01-14T09:22:00Z',
    addresses: [
      {
        id: 553,
        company_id: 101,
        kind: 'billing',
        line1: 'Plot 23, Gulberg III',
        line2: 'Floor 4, Block H',
        city: 'Lahore',
        state: 'Punjab',
        zip: '54660',
        country: 'PK',
      },
      {
        id: 555,
        company_id: 101,
        kind: 'pickup',
        line1: 'Industrial Estate, Phase 2',
        line2: null,
        city: 'Lahore',
        state: 'Punjab',
        zip: '54750',
        country: 'PK',
      },
    ],
    orders: [
      {
        id: 900012,
        company_id: 101,
        billing_address_id: 553,
        pickup_address_id: 555,
        source_system: 'hb-leads-crm',
        source_lead_id: 1987,
        source_order_id: 'HB-2026-0412',
        title: 'Server decommission — Q2',
        services: ['Hardkill (Physical Destruction)', 'Pickup & Logistics', 'Inventory Summary'],
        type_of_equipment: 'Rack Servers, Switches',
        quantity: '42',
        estimate_value: 1250000,
        pickup_cost: 75000,
        pickup_cost_status: 'approved',
        status: 'completed',
        qualify_status: 'qualified',
        data_destruction_type: 'on-site-shred',
        message: 'Two pallets ready at loading dock B.',
        start_date: '2026-05-02',
        pickup_date: '2026-05-05',
        attachments: ['manifest.pdf', 'signed-work-order.pdf'],
        created_at: '2026-04-20T10:00:00Z',
        detail_rows: [
          {
            order_seq: 'HB023293-01',
            pk_status: 'FBA Listing Created',
            asin: 'B0D12P8S94',
            location: '2/19-FBA18TPZ8YK2',
            make_model: 'Dell Latitude 7420',
            model_type: 'P135G001',
            serial_number: '5ZZB6G3',
            condition: 'B+',
            next_steps: 'Clean',
            market: 'AMZ',
            order_id: '111-2700817-3949808',
            price: 269,
            fees: 31.52,
            profit: 137.48,
            notes: 'minor scratch on top',
          },
          {
            order_seq: 'HB023293-02',
            pk_status: 'SOLD Wholesale',
            asin: 'no active listings',
            location: 'Wholesale Batch',
            make_model: 'HP Laptop',
            model_type: '2C8Q1UA#ABA',
            serial_number: 'CND0480GKM',
            condition: 'C',
            next_steps: 'Recycle',
            market: 'UAE',
            notes: 'Low Generation',
          },
          {
            order_seq: 'HB023293-03',
            pk_status: 'Other Markets - Listed',
            asin: 'no active listings',
            location: 'Rack 2C Clean Box 1',
            make_model: 'Lenovo IdeaPad 3',
            model_type: '82H800K7US',
            serial_number: 'PF2ZTQ9K',
            condition: 'B+',
            next_steps: 'Clean',
            market: 'Ebay',
            order_id: '12-12837-32857',
            price: 179,
            fees: 24.32,
            profit: 54.68,
          },
        ],
      },
      {
        id: 900021,
        company_id: 101,
        billing_address_id: 553,
        pickup_address_id: 555,
        source_system: 'hb-leads-crm',
        source_lead_id: 2011,
        source_order_id: 'HB-2026-0489',
        title: 'Pickup — legacy hardware batch',
        services: ['Hard Kill', 'Data Sanitization', 'Remarketing'],
        type_of_equipment: 'Laptops, Monitors',
        quantity: '128',
        estimate_value: 480000,
        pickup_cost: 28000,
        pickup_cost_status: 'pending',
        status: 'in_progress',
        qualify_status: 'qualified',
        start_date: '2026-05-14',
        pickup_date: '2026-05-18',
        attachments: ['inventory.xlsx'],
        created_at: '2026-04-22T08:30:00Z',
        detail_rows: [],
      },
      {
        id: 900033,
        company_id: 101,
        billing_address_id: 553,
        pickup_address_id: 555,
        source_system: 'hb-leads-crm',
        source_lead_id: 2044,
        source_order_id: 'HB-2026-0512',
        title: 'Data destruction — quarterly',
        services: ['Hard Kill', 'Serial Number Audit'],
        type_of_equipment: 'HDDs, SSDs',
        quantity: '310',
        estimate_value: 192000,
        pickup_cost: 12000,
        pickup_cost_status: 'approved',
        status: 'new',
        qualify_status: 'pending',
        data_destruction_type: 'shred-on-site',
        start_date: '2026-05-25',
        pickup_date: '2026-05-27',
        attachments: [],
        created_at: '2026-04-23T07:12:00Z',
        detail_rows: [],
      },
    ],
  },
  {
    id: 132,
    name: 'BluePeak Textiles',
    primary_contact_name: 'Nadeem Ali',
    project_manager: 'Sana Bilal',
    primary_email: 'nadeem@bluepeak.com',
    primary_phone: '+92 21 5551234',
    customer_type: 'commercial',
    lead_channel: 'referral',
    hear_about_us: 'Partner Referral',
    created_at: '2026-02-02T12:40:00Z',
    addresses: [
      {
        id: 610,
        company_id: 132,
        kind: 'billing',
        line1: 'Clifton Block 5',
        line2: null,
        city: 'Karachi',
        state: 'Sindh',
        zip: '75600',
        country: 'PK',
      },
      {
        id: 611,
        company_id: 132,
        kind: 'pickup',
        line1: 'SITE Industrial Area',
        line2: 'Warehouse 7',
        city: 'Karachi',
        state: 'Sindh',
        zip: '75700',
        country: 'PK',
      },
    ],
    orders: [
      {
        id: 900013,
        company_id: 132,
        billing_address_id: 610,
        pickup_address_id: 611,
        source_system: 'hb-leads-crm',
        source_lead_id: 1990,
        source_order_id: 'HB-2026-0415',
        title: 'Warehouse IT cleanup',
        services: ['Pickup & Logistics', 'Testing & Grading'],
        type_of_equipment: 'Desktops, Printers',
        quantity: '86',
        estimate_value: 845000,
        pickup_cost: 41000,
        pickup_cost_status: 'approved',
        status: 'in_progress',
        qualify_status: 'qualified',
        start_date: '2026-05-06',
        pickup_date: '2026-05-09',
        attachments: ['packing-list.pdf'],
        created_at: '2026-04-21T09:45:00Z',
        detail_rows: [],
      },
      {
        id: 900029,
        company_id: 132,
        billing_address_id: 610,
        pickup_address_id: 611,
        source_system: 'hb-leads-crm',
        source_lead_id: 2023,
        source_order_id: 'HB-2026-0501',
        title: 'Office relocation — Phase 1',
        services: ['Dismantling', 'Pickup & Logistics'],
        type_of_equipment: 'Desks, Network Gear',
        quantity: '54',
        estimate_value: 310000,
        pickup_cost: 22000,
        pickup_cost_status: 'pending',
        status: 'new',
        qualify_status: 'pending',
        start_date: '2026-05-20',
        pickup_date: '2026-05-22',
        attachments: [],
        created_at: '2026-04-23T06:50:00Z',
        detail_rows: [],
      },
    ],
  },
  {
    id: 188,
    name: 'Zenith Agro Exports',
    primary_contact_name: 'Muneeb Arif',
    project_manager: 'Ali Hamza',
    primary_email: 'muneeb@zenithagro.com',
    primary_phone: '+92 41 2228899',
    customer_type: 'commercial',
    lead_channel: 'outbound',
    hear_about_us: 'Trade Show',
    created_at: '2026-02-18T15:00:00Z',
    addresses: [
      {
        id: 701,
        company_id: 188,
        kind: 'billing',
        line1: 'Jaranwala Road',
        line2: 'Unit 9',
        city: 'Faisalabad',
        state: 'Punjab',
        zip: '38000',
        country: 'PK',
      },
      {
        id: 702,
        company_id: 188,
        kind: 'pickup',
        line1: 'Agro Storage Facility',
        line2: null,
        city: 'Faisalabad',
        state: 'Punjab',
        zip: '38090',
        country: 'PK',
      },
    ],
    orders: [
      {
        id: 900014,
        company_id: 188,
        billing_address_id: 701,
        pickup_address_id: 702,
        source_system: 'hb-leads-crm',
        source_lead_id: 1998,
        source_order_id: 'HB-2026-0420',
        title: 'Legacy factory floor clearance',
        services: ['Asset Recovery', 'Data Wipe Certification'],
        type_of_equipment: 'Industrial PCs',
        quantity: '24',
        estimate_value: 2940000,
        pickup_cost: 180000,
        pickup_cost_status: 'approved',
        status: 'new',
        qualify_status: 'qualified',
        start_date: '2026-06-01',
        pickup_date: '2026-06-03',
        attachments: ['floor-plan.pdf', 'equipment-list.pdf'],
        created_at: '2026-04-22T11:10:00Z',
        detail_rows: [],
      },
    ],
  },
  {
    id: 204,
    name: 'NovaCore Logistics',
    primary_contact_name: 'Sara Iqbal',
    project_manager: 'Umar Farooq',
    primary_email: 'sara@novacore.pk',
    primary_phone: '+92 51 3344556',
    customer_type: 'commercial',
    lead_channel: 'web',
    hear_about_us: 'LinkedIn Ad',
    created_at: '2026-03-04T08:15:00Z',
    addresses: [
      {
        id: 810,
        company_id: 204,
        kind: 'billing',
        line1: 'Blue Area',
        line2: 'Tower F, 7th Floor',
        city: 'Islamabad',
        state: 'ICT',
        zip: '44000',
        country: 'PK',
      },
      {
        id: 811,
        company_id: 204,
        kind: 'pickup',
        line1: 'I-9 Industrial Area',
        line2: null,
        city: 'Islamabad',
        state: 'ICT',
        zip: '44790',
        country: 'PK',
      },
    ],
    orders: [
      {
        id: 900051,
        company_id: 204,
        billing_address_id: 810,
        pickup_address_id: 811,
        source_system: 'hb-leads-crm',
        source_lead_id: 2055,
        source_order_id: 'HB-2026-0530',
        title: 'Branch upgrade — workstations',
        services: ['Testing & Grading', 'Resale Preparation'],
        type_of_equipment: 'Workstations, Docks',
        quantity: '70',
        estimate_value: 620000,
        pickup_cost: 35000,
        pickup_cost_status: 'approved',
        status: 'in_progress',
        qualify_status: 'qualified',
        start_date: '2026-05-10',
        pickup_date: '2026-05-13',
        attachments: ['scope-of-work.pdf'],
        created_at: '2026-04-21T13:20:00Z',
        detail_rows: [],
      },
    ],
  },
];
