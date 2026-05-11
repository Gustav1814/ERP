<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('company_user_pickup_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_user_id')->constrained('company_users')->cascadeOnDelete();
            $table->foreignId('company_address_id')->constrained('company_addresses')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['company_user_id', 'company_address_id'], 'company_user_pickup_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_user_pickup_addresses');
    }
};
