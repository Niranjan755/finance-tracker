import { NavLink } from 'react-router-dom'
import { Wallet2 } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { AddTransactionMenu } from '@/components/finance/AddTransactionMenu'
import { PRIMARY_NAV, SECONDARY_NAV } from './navConfig'

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="gap-3 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Wallet2 className="size-4.5" aria-hidden="true" />
          </div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Finance Tracker
          </span>
        </div>
        <AddTransactionMenu className="w-full group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY_NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    render={
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className="aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY_NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    render={
                      <NavLink
                        to={item.to}
                        className="aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
