import os

lines = open('main.py', encoding='utf-8').read().splitlines()
idx = -1
for i, line in enumerate(lines):
    if 'html_report_filename = f"dimensionality_report_' in line:
        idx = i
        break

new_end = """        html_report_filename = f"dimensionality_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        html_report_path = os.path.join(session_dir, html_report_filename)
        
        compile_dimensionality_html_report(dim_summary, html_report_path)
        
        return {
            "status": "success",
            "message": "Final dataset produced and saved! Multicollinearity threat cleared.",
            "final_file": final_filename,
            "html_report_file": html_report_filename,
            "ai_summary": ai_summary,
            "ai_summary_error": ai_summary_error,
            "stats": {
                "rows": len(final_df),
                "columns": len(final_df.columns),
                "features_retained": len(config.retained_features),
                "features_dropped": len(config.dropped_features)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/preview/{filename}")
async def preview_data(filename: str, session_id: str = Query(...)):
    session_dir = get_session_dir(session_id)
    file_path = os.path.join(session_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        df = pd.read_csv(file_path, nrows=10)
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)
                
        df = df.fillna("")
        
        columns = list(df.columns)
        rows = df.values.tolist()
        
        return {
            "columns": columns,
            "rows": rows,
            "total_rows_preview": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preview: {str(e)}")

@app.get("/api/download/{filename}")
async def download_file(filename: str, session_id: str = Query(...)):
    session_dir = get_session_dir(session_id)
    file_path = os.path.join(session_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    media_type = "text/csv"
    if filename.endswith(".html"):
        media_type = "text/html"
        
    return FileResponse(path=file_path, filename=filename, media_type=media_type)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
"""

with open('main.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines[:idx]) + '\n' + new_end)
