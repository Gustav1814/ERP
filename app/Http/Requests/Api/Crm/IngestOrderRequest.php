<?php

namespace App\Http\Requests\Api\Crm;

use Illuminate\Foundation\Http\FormRequest;

class IngestOrderRequest extends FormRequest
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
            'source.system' => ['required', 'string', 'max:50'],
            'source.lead_id' => ['required', 'integer', 'min:1'],
            'source.order_id' => ['nullable', 'string', 'max:50'],
            'company_binding.mode' => ['required', 'in:existing,new'],
            'company_binding.existing_company_id' => ['nullable', 'integer', 'min:1'],
            'company.name' => ['required', 'string', 'max:255'],
            'company.primary_contact_name' => ['nullable', 'string', 'max:150'],
            'company.primary_email' => ['nullable', 'email', 'max:150'],
            'company.primary_phone' => ['nullable', 'string', 'max:50'],
            'order.title' => ['nullable', 'string', 'max:200'],
            'order.type_of_equipment' => ['nullable', 'string'],
            'order.quantity' => ['nullable', 'string', 'max:50'],
            'order.estimate_value' => ['nullable', 'numeric'],
            'order.pickup_cost' => ['nullable', 'numeric'],
            'order.pickup_cost_status' => ['nullable', 'string', 'max:50'],
            'order.status' => ['nullable', 'string', 'max:50'],
            'order.qualify_status' => ['nullable', 'string', 'max:50'],
            'order.data_destruction_type' => ['nullable', 'string', 'max:100'],
            'order.message' => ['nullable', 'string'],
            'order.attachments' => ['nullable', 'array'],
            'order.attachments.*' => ['string'],
            'addresses.billing' => ['nullable', 'array'],
            'addresses.pickup' => ['nullable', 'array'],
            'schedule.start_date' => ['nullable', 'date'],
            'schedule.pickup_date' => ['nullable', 'date'],
        ];
    }
}
