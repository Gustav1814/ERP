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
        Schema::create('company_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->enum('kind', ['billing', 'pickup', 'shipping', 'other'])->default('other');
            $table->string('line1', 200);
            $table->string('line2', 200)->nullable();
            $table->string('city', 100);
            $table->string('state', 100);
            $table->string('zip', 20);
            $table->char('country', 2)->default('US');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'kind']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_addresses');
    }
};
