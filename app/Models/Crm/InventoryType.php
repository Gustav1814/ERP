<?php

namespace App\Models\Crm;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'default_weight_lbs',
        'default_length',
        'default_width',
        'default_height',
        'sort_order',
    ];

    protected $casts = [
        'default_weight_lbs' => 'float',
        'default_length' => 'float',
        'default_width' => 'float',
        'default_height' => 'float',
    ];
}

