<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\ServiceCatalog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceCatalogController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'data' => ServiceCatalog::query()->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('crm_services', 'name')->whereNull('deleted_at')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $service = ServiceCatalog::query()->create([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $service], 201);
    }

    public function update(Request $request, ServiceCatalog $service)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('crm_services', 'name')->whereNull('deleted_at')->ignore($service->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $service->update([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? $service->sort_order ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $service->fresh()]);
    }

    public function destroy(ServiceCatalog $service)
    {
        $service->delete();

        return response()->json(['status' => 'ok']);
    }
}

