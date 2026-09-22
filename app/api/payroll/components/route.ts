import { NextResponse } from 'next/server';
import { DataStore } from '@/lib/data-store';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const components = await DataStore.getSalaryComponents();
    return NextResponse.json(components);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, is_active, value } = body;

    let updated;
    if (is_active !== undefined) {
      updated = await DataStore.updateSalaryComponent(id, { is_active });
    }
    if (value !== undefined) {
      updated = await DataStore.updateSalaryComponent(id, { value: Number(value) });
    }

    return NextResponse.json({ success: true, component: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
