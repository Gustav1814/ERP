<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\PickupByOption;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PickupByOptionController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'data' => PickupByOption::query()->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('pickup_by_options', 'name')->whereNull('deleted_at')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = PickupByOption::query()->create([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $item], 201);
    }

    public function update(Request $request, PickupByOption $pickupByOption)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('pickup_by_options', 'name')->whereNull('deleted_at')->ignore($pickupByOption->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $pickupByOption->update([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? $pickupByOption->sort_order ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $pickupByOption->fresh()]);
    }

    public function destroy(PickupByOption $pickupByOption)
    {
        $pickupByOption->delete();

        return response()->json(['status' => 'ok']);
    }
}

