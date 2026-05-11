<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'primary_contact_name',
        'project_manager',
        'primary_email',
        'primary_phone',
        'primary_contact_user_id',
        'customer_type',
        'lead_channel',
        'hear_about_us',
        'is_new',
    ];

    public function addresses(): HasMany
    {
        return $this->hasMany(CompanyAddress::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(ErpOrder::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(CompanyUser::class);
    }

    public function primaryContactUser(): BelongsTo
    {
        return $this->belongsTo(CompanyUser::class, 'primary_contact_user_id');
    }
}
