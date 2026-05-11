<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\IndustryType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IndustryTypeController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'data' => IndustryType::query()->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('industry_types', 'name')->whereNull('deleted_at')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = IndustryType::query()->create([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $item], 201);
    }

    public function update(Request $request, IndustryType $industryType)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('industry_types', 'name')->whereNull('deleted_at')->ignore($industryType->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $industryType->update([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? $industryType->sort_order ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $industryType->fresh()]);
    }

    public function destroy(IndustryType $industryType)
    {
        $industryType->delete();

        return response()->json(['status' => 'ok']);
    }
}

