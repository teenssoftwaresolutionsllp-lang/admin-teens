import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import EmployeeTable from '@/components/EmployeeTable'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'hr'

  const [employeesRes, departmentsRes] = await Promise.all([
    supabase.from('employees').select('*, department:departments(*)').order('created_at', { ascending: false }),
    supabase.from('departments').select('*').order('name')
  ])

  const employees = employeesRes.data || []
  const departments = departmentsRes.data || []

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employees</h1>
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-semibold text-indigo-700">
            {employees.length}
          </span>
        </div>
        
        {role === 'hr' && (
          <Link
            href="/dashboard/employees/add"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Add Employee
          </Link>
        )}
      </div>

      <EmployeeTable employees={employees} departments={departments} role={role} />
    </div>
  )
}
