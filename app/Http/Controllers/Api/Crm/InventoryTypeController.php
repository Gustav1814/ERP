<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\InventoryType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryTypeController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'data' => InventoryType::query()->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('inventory_types', 'name')->whereNull('deleted_at')],
            'default_weight_lbs' => ['nullable', 'numeric', 'min:0'],
            'default_length' => ['nullable', 'numeric', 'min:0'],
            'default_width' => ['nullable', 'numeric', 'min:0'],
            'default_height' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $type = InventoryType::query()->create([
            'name' => trim((string) $data['name']),
            'default_weight_lbs' => $data['default_weight_lbs'] ?? null,
            'default_length' => $data['default_length'] ?? null,
            'default_width' => $data['default_width'] ?? null,
            'default_height' => $data['default_height'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $type], 201);
    }

    public function update(Request $request, InventoryType $inventoryType)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('inventory_types', 'name')->whereNull('deleted_at')->ignore($inventoryType->id),
            ],
            'default_weight_lbs' => ['nullable', 'numeric', 'min:0'],
            'default_length' => ['nullable', 'numeric', 'min:0'],
            'default_width' => ['nullable', 'numeric', 'min:0'],
            'default_height' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $inventoryType->update([
            'name' => trim((string) $data['name']),
            'default_weight_lbs' => $data['default_weight_lbs'] ?? null,
            'default_length' => $data['default_length'] ?? null,
            'default_width' => $data['default_width'] ?? null,
            'default_height' => $data['default_height'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? $inventoryType->sort_order ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $inventoryType->fresh()]);
    }

    public function destroy(InventoryType $inventoryType)
    {
        $inventoryType->delete();

        return response()->json(['status' => 'ok']);
    }
}

