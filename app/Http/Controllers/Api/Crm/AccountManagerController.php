<?php

namespace App\Http\Controllers\Api\Crm;

use App\Http\Controllers\Controller;
use App\Models\Crm\AccountManager;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountManagerController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'ok',
            'data' => AccountManager::query()->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('account_managers', 'name')->whereNull('deleted_at')],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = AccountManager::query()->create([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $item], 201);
    }

    public function update(Request $request, AccountManager $accountManager)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('account_managers', 'name')->whereNull('deleted_at')->ignore($accountManager->id),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $accountManager->update([
            'name' => trim((string) $data['name']),
            'sort_order' => (int) ($data['sort_order'] ?? $accountManager->sort_order ?? 0),
        ]);

        return response()->json(['status' => 'ok', 'data' => $accountManager->fresh()]);
    }

    public function destroy(AccountManager $accountManager)
    {
        $accountManager->delete();

        return response()->json(['status' => 'ok']);
    }
}
