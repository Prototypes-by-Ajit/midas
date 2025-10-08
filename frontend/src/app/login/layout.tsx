
export interface Layout { 
    children:React.ReactNode;
}


export default function RootLayout({children}:Layout) { 
    return ( 
        <html>
            <body>
  
                    {children}
        
            </body>
        </html>
    )
}