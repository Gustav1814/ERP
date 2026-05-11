<?php

namespace Database\Seeders;

use App\Models\Crm\IndustryType;
use Illuminate\Database\Seeder;

class IndustryTypesSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'Automotive',
            'Banking',
            'Construction',
            'Education',
            'Energy',
            'Finance',
            'Government',
            'Healthcare',
            'Hospitality',
            'Insurance',
            'Logistics',
            'Manufacturing',
            'Retail',
            'Technology',
            'Telecommunications',
        ];

        foreach ($defaults as $i => $name) {
            $trimmed = trim($name);
            if ($trimmed === '') {
                continue;
            }

            $existing = IndustryType::withTrashed()
                ->whereRaw('LOWER(name) = ?', [strtolower($trimmed)])
                ->first();

            if ($existing) {
                if ($existing->trashed()) {
                    $existing->restore();
                }
                if ((int) $existing->sort_order !== $i) {
                    $existing->sort_order = $i;
                    $existing->save();
                }
                continue;
            }

            IndustryType::query()->create([
                'name' => $trimmed,
                'sort_order' => $i,
            ]);
        }
    }
}

