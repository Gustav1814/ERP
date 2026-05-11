<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AccountManager extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'sort_order',
    ];
}
