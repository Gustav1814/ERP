<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_types', function (Blueprint $table) {
            $table->decimal('default_length', 10, 2)->nullable()->after('default_weight_lbs');
            $table->decimal('default_width', 10, 2)->nullable()->after('default_length');
            $table->decimal('default_height', 10, 2)->nullable()->after('default_width');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_types', function (Blueprint $table) {
            $table->dropColumn(['default_length', 'default_width', 'default_height']);
        });
    }
};

