<?php

namespace App\Http\Requests\Api\Crm;

use Illuminate\Foundation\Http\FormRequest;

class ImportCommitRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'handoff' => ['nullable', 'string'],
            'queue_id' => ['nullable', 'integer', 'min:1'],
            'company_binding.mode' => ['required', 'in:existing,new'],
            'company_binding.existing_company_id' => ['nullable', 'integer', 'min:1'],
            'company_binding.billing_address_id' => ['nullable', 'integer', 'min:1'],
            'company' => ['required', 'array'],
            'addresses' => ['required', 'array'],
            'order' => ['required', 'array'],
            'schedule' => ['nullable', 'array'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $handoff = data_get($this->all(), 'handoff');
            $queueId = data_get($this->all(), 'queue_id');
            $mode = data_get($this->all(), 'company_binding.mode');
            $existingCompanyId = data_get($this->all(), 'company_binding.existing_company_id');

            if (! $handoff && ! $queueId) {
                $validator->errors()->add('handoff', 'Either handoff or queue_id is required.');
            }

            if ($mode === 'existing' && ! $existingCompanyId) {
                $validator->errors()->add(
                    'company_binding.existing_company_id',
                    'existing_company_id is required when mode is existing.'
                );
            }
        });
    }
}
