<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_handoff_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('jti', 100)->unique();
            $table->unsignedBigInteger('lead_id');
            $table->unsignedBigInteger('issued_by_user_id');
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();

            $table->index('lead_id');
            $table->index('issued_by_user_id');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_handoff_tokens');
    }
};
